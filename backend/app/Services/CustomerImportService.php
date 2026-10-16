<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserAddress;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class CustomerImportService
{
    /**
     * Standard allowed Australian States and Territories.
     */
    public const VALID_AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

    /**
     * Map of known state names and variations to canonical 2-3 letter codes.
     */
    protected const STATE_MAPPINGS = [
        'nsw' => 'NSW',
        'new south wales' => 'NSW',
        'vic' => 'VIC',
        'victoria' => 'VIC',
        'qld' => 'QLD',
        'queensland' => 'QLD',
        'wa' => 'WA',
        'western australia' => 'WA',
        'sa' => 'SA',
        'south australia' => 'SA',
        'tas' => 'TAS',
        'tasmania' => 'TAS',
        'act' => 'ACT',
        'australian capital territory' => 'ACT',
        'nt' => 'NT',
        'northern territory' => 'NT',
    ];

    /**
     * Recognized system target fields and their common header synonyms.
     */
    public const TARGET_FIELDS = [
        'name' => [
            'label' => 'Name',
            'required' => true,
            'synonyms' => ['name', 'full name', 'customer name', 'contact name', 'display name'],
        ],
        'company_name' => [
            'label' => 'Company Name',
            'required' => false,
            'synonyms' => ['company name', 'company', 'business name', 'organization', 'organisation'],
        ],
        'street_address' => [
            'label' => 'Street Address',
            'required' => false,
            'synonyms' => ['street address', 'street', 'address line 1', 'address 1', 'address', 'street_address'],
        ],
        'city_suburb' => [
            'label' => 'City / Suburb',
            'required' => false,
            'synonyms' => ['city/suburb', 'city', 'suburb', 'town', 'locality', 'city_suburb'],
        ],
        'state' => [
            'label' => 'State',
            'required' => false,
            'synonyms' => ['state', 'state/territory', 'province', 'region'],
        ],
        'country' => [
            'label' => 'Country',
            'required' => false,
            'synonyms' => ['country', 'nation', 'country code'],
        ],
        'postcode' => [
            'label' => 'Postcode',
            'required' => false,
            'synonyms' => ['postcode', 'postal code', 'zip', 'zip code', 'pcode', 'postal'],
        ],
        'phone' => [
            'label' => 'Phone',
            'required' => false,
            'synonyms' => ['phone', 'phone number', 'telephone', 'mobile', 'mobile number', 'contact number'],
        ],
        'email' => [
            'label' => 'Email',
            'required' => true,
            'synonyms' => ['email', 'email address', 'e-mail', 'mail'],
        ],
    ];

    /**
     * Columns that must be explicitly ignored and never imported.
     */
    public const IGNORED_FIELDS = [
        'open balance',
        'open_balance',
        'balance',
        'attachments',
        'attachment count',
        'attachments count',
    ];

    /**
     * Parse raw CSV file or string into headers and data rows.
     */
    public function parseCsv(UploadedFile|string $file): array
    {
        $content = '';
        if ($file instanceof UploadedFile) {
            $content = file_get_contents($file->getRealPath());
        } elseif (is_string($file) && file_exists($file)) {
            $content = file_get_contents($file);
        } else {
            $content = (string) $file;
        }

        // Strip UTF-8 BOM if present
        if (str_starts_with($content, "\xEF\xBB\xBF")) {
            $content = substr($content, 3);
        }

        // Normalize line breaks
        $content = str_replace(["\r\n", "\r"], "\n", $content);
        $lines = explode("\n", $content);

        // Remove empty trailing lines
        while (!empty($lines) && trim(end($lines)) === '') {
            array_pop($lines);
        }

        if (empty($lines)) {
            return [
                'headers' => [],
                'rows' => [],
            ];
        }

        // Auto-detect delimiter from the first line (comma, tab, semicolon)
        $firstLine = $lines[0];
        $delimiter = ',';
        $commaCount = substr_count($firstLine, ',');
        $tabCount = substr_count($firstLine, "\t");
        $semiCount = substr_count($firstLine, ';');

        if ($tabCount > $commaCount && $tabCount > $semiCount) {
            $delimiter = "\t";
        } elseif ($semiCount > $commaCount && $semiCount > $tabCount) {
            $delimiter = ';';
        }

        // Parse header row
        $rawHeaders = str_getcsv($lines[0], $delimiter);
        $headers = array_map(function ($h) {
            return trim((string) $h, " \t\n\r\0\x0B\"'");
        }, $rawHeaders);

        $parsedRows = [];
        $lineCount = count($lines);

        for ($i = 1; $i < $lineCount; $i++) {
            $rawLine = $lines[$i];
            if (trim($rawLine) === '') {
                continue;
            }

            $cols = str_getcsv($rawLine, $delimiter);
            $rowObj = [];
            foreach ($headers as $colIdx => $headerName) {
                $val = $cols[$colIdx] ?? null;
                $rowObj[$headerName] = $val !== null ? trim($val) : '';
            }

            $parsedRows[] = [
                'row_number' => $i + 1, // 1-indexed for user presentation (Row 1 is header)
                'data' => $rowObj,
                'raw_line' => $rawLine,
            ];
        }

        return [
            'headers' => $headers,
            'rows' => $parsedRows,
        ];
    }

    /**
     * Detect mapping between detected CSV headers and target system fields.
     */
    public function detectMapping(array $headers): array
    {
        $mapping = [];
        $normalizedHeaders = [];

        foreach ($headers as $header) {
            $clean = strtolower(trim($header));
            $clean = str_replace(['_', '-'], ' ', $clean);
            $clean = preg_replace('/\s+/', ' ', $clean);
            $normalizedHeaders[$clean] = $header;
        }

        foreach (self::TARGET_FIELDS as $fieldKey => $config) {
            $matchedHeader = null;

            // Direct synonyms check
            foreach ($config['synonyms'] as $synonym) {
                if (isset($normalizedHeaders[$synonym])) {
                    $matchedHeader = $normalizedHeaders[$synonym];
                    break;
                }
            }

            // Fuzzy substring check if not found
            if (!$matchedHeader) {
                foreach ($normalizedHeaders as $cleanKey => $origHeader) {
                    if (str_contains($cleanKey, strtolower($fieldKey))) {
                        $matchedHeader = $origHeader;
                        break;
                    }
                }
            }

            if ($matchedHeader) {
                $mapping[$fieldKey] = $matchedHeader;
            }
        }

        return $mapping;
    }

    /**
     * Preview CSV data and return comprehensive validation report without persisting changes.
     */
    public function preview(UploadedFile|string $file, ?array $customMapping = null, bool $skipDuplicates = true): array
    {
        $parsed = $this->parseCsv($file);
        $headers = $parsed['headers'];
        $rows = $parsed['rows'];

        $mapping = $customMapping ?: $this->detectMapping($headers);
        $validationResult = $this->validateRows($rows, $mapping, $skipDuplicates);

        return [
            'total_rows' => count($rows),
            'valid_count' => count($validationResult['valid']),
            'skipped_count' => count($validationResult['skipped']),
            'invalid_count' => count($validationResult['invalid']),
            'headers' => $headers,
            'mapping' => $mapping,
            'preview_rows' => $validationResult['preview_items'],
            'skipped_rows' => $validationResult['skipped'],
            'invalid_rows' => $validationResult['invalid'],
        ];
    }

    /**
     * Import valid customers into the database within transactional boundaries.
     */
    public function import(UploadedFile|string $file, ?array $customMapping = null, bool $skipDuplicates = true): array
    {
        $parsed = $this->parseCsv($file);
        $headers = $parsed['headers'];
        $rows = $parsed['rows'];

        $mapping = $customMapping ?: $this->detectMapping($headers);
        $validationResult = $this->validateRows($rows, $mapping, $skipDuplicates);

        $validRows = $validationResult['valid'];
        $skippedRows = $validationResult['skipped'];
        $invalidRows = $validationResult['invalid'];

        $importedCount = 0;
        $failedRows = [];

        foreach ($validRows as $item) {
            $rowNumber = $item['row_number'];
            $customerData = $item['customer'];
            $addressData = $item['address'];

            try {
                DB::transaction(function () use ($customerData, $addressData) {
                    // Create customer user
                    $user = User::create([
                        'name' => $customerData['name'],
                        'email' => $customerData['email'],
                        'phone' => $customerData['phone'],
                        'company_name' => $customerData['company_name'],
                        'abn' => null,
                        'role' => User::ROLE_CUSTOMER,
                        'password' => Hash::make(Str::random(32)),
                        'is_super_admin' => false,
                        'is_active' => true,
                    ]);

                    // Create user address if address details are present
                    if ($addressData !== null) {
                        $user->addresses()->create([
                            'type' => 'shipping',
                            'name' => $customerData['name'],
                            'company' => $customerData['company_name'],
                            'address_line_1' => $addressData['address_line_1'],
                            'address_line_2' => null,
                            'suburb' => $addressData['suburb'],
                            'state' => $addressData['state'],
                            'postcode' => $addressData['postcode'],
                            'country' => $addressData['country'],
                            'phone' => $customerData['phone'] ?: '0000000000',
                            'is_default' => true,
                        ]);
                    }
                });

                $importedCount++;
            } catch (\Throwable $e) {
                $failedRows[] = [
                    'row_number' => $rowNumber,
                    'status' => 'failed',
                    'name' => $customerData['name'] ?? '',
                    'company' => $customerData['company_name'] ?? '',
                    'email' => $customerData['email'] ?? '',
                    'phone' => $customerData['phone'] ?? '',
                    'street_address' => $addressData['address_line_1'] ?? '',
                    'city_suburb' => $addressData['suburb'] ?? '',
                    'state' => $addressData['state'] ?? '',
                    'postcode' => $addressData['postcode'] ?? '',
                    'country' => $addressData['country'] ?? 'AU',
                    'reason' => 'Database error during insertion: ' . $e->getMessage(),
                    'errors' => ['Database error: ' . $e->getMessage()],
                ];
            }
        }

        // Combine skipped and invalid rows for downloadable report
        $allReportRows = array_merge($skippedRows, $invalidRows, $failedRows);
        usort($allReportRows, fn ($a, $b) => ($a['row_number'] ?? 0) <=> ($b['row_number'] ?? 0));

        $reportCsv = $this->generateReportCsv($allReportRows);

        return [
            'success' => true,
            'message' => "Import completed: {$importedCount} customers imported, " . count($skippedRows) . " skipped, " . (count($invalidRows) + count($failedRows)) . " failed.",
            'total_rows' => count($rows),
            'imported_count' => $importedCount,
            'skipped_count' => count($skippedRows),
            'invalid_count' => count($invalidRows) + count($failedRows),
            'skipped_rows' => $skippedRows,
            'invalid_rows' => array_merge($invalidRows, $failedRows),
            'report_csv' => $reportCsv,
        ];
    }

    /**
     * Validate all rows against mapping, schema rules, Australian formatting, and duplicates.
     */
    protected function validateRows(array $rows, array $mapping, bool $skipDuplicates): array
    {
        $valid = [];
        $skipped = [];
        $invalid = [];
        $previewItems = [];

        // Track seen emails within this CSV batch
        $seenEmails = [];

        // Preload existing emails for quick lookup
        $csvEmails = [];
        foreach ($rows as $row) {
            $emailHeader = $mapping['email'] ?? null;
            if ($emailHeader && isset($row['data'][$emailHeader])) {
                $e = strtolower(trim((string) $row['data'][$emailHeader]));
                if ($e !== '') {
                    $csvEmails[] = $e;
                }
            }
        }

        $existingDbEmails = [];
        if (!empty($csvEmails)) {
            $existingDbEmails = User::whereIn('email', array_unique($csvEmails))
                ->pluck('email')
                ->map(fn ($em) => strtolower(trim($em)))
                ->flip()
                ->toArray();
        }

        foreach ($rows as $item) {
            $rowNumber = $item['row_number'];
            $rawData = $item['data'];
            $errors = [];

            // Extract mapped fields
            $name = $this->getMappedValue($rawData, $mapping, 'name');
            $companyName = $this->getMappedValue($rawData, $mapping, 'company_name');
            $streetAddress = $this->getMappedValue($rawData, $mapping, 'street_address');
            $citySuburb = $this->getMappedValue($rawData, $mapping, 'city_suburb');
            $stateRaw = $this->getMappedValue($rawData, $mapping, 'state');
            $countryRaw = $this->getMappedValue($rawData, $mapping, 'country');
            $postcodeRaw = $this->getMappedValue($rawData, $mapping, 'postcode');
            $phone = $this->getMappedValue($rawData, $mapping, 'phone');
            $emailRaw = $this->getMappedValue($rawData, $mapping, 'email');

            // 1. Email validation
            $email = strtolower(trim((string) $emailRaw));
            if ($email === '') {
                $errors[] = 'Email address is required.';
            } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors[] = "Invalid email address format ('{$emailRaw}').";
            }

            // 2. Name / Company validation
            $displayName = trim((string) $name);
            if ($displayName === '') {
                $displayName = trim((string) $companyName);
            }
            if ($displayName === '') {
                $errors[] = 'Customer Name or Company Name is required.';
            }

            // 3. Address validation
            $addressData = null;
            $hasAnyAddress = ($streetAddress !== '' || $citySuburb !== '' || $stateRaw !== '' || $postcodeRaw !== '');

            $normalizedState = null;
            $normalizedCountry = $this->normalizeCountry($countryRaw);
            $cleanPostcode = null;

            if ($hasAnyAddress) {
                if ($streetAddress === '') {
                    $errors[] = 'Street Address is required when address fields are provided.';
                }
                if ($citySuburb === '') {
                    $errors[] = 'City/Suburb is required when address fields are provided.';
                }

                // State validation
                if ($stateRaw === '') {
                    $errors[] = 'State is required when address fields are provided.';
                } else {
                    $normalizedState = $this->normalizeAustralianState($stateRaw);
                    if (!$normalizedState) {
                        $errors[] = "Invalid Australian state '{$stateRaw}'. Must be one of: " . implode(', ', self::VALID_AU_STATES) . '.';
                    }
                }

                // Postcode validation
                if ($postcodeRaw === '') {
                    $errors[] = 'Postcode is required when address fields are provided.';
                } else {
                    $cleanPostcode = preg_replace('/\s+/', '', (string) $postcodeRaw);
                    // Handle 3-digit postcodes with leading zero (e.g. Darwin 800 -> 0800)
                    if (strlen($cleanPostcode) === 3 && ctype_digit($cleanPostcode)) {
                        $cleanPostcode = str_pad($cleanPostcode, 4, '0', STR_PAD_LEFT);
                    }

                    if (!preg_match('/^[0-9]{4}$/', $cleanPostcode)) {
                        $errors[] = "Postcode '{$postcodeRaw}' must be a 4-digit Australian postcode.";
                    } elseif ($normalizedState && !$this->isValidAustralianPostcode($cleanPostcode, $normalizedState)) {
                        $errors[] = "Postcode '{$cleanPostcode}' does not match Australian state {$normalizedState}.";
                    }
                }

                if (empty($errors)) {
                    $addressData = [
                        'address_line_1' => $streetAddress,
                        'suburb' => $citySuburb,
                        'state' => $normalizedState,
                        'postcode' => $cleanPostcode,
                        'country' => $normalizedCountry,
                    ];
                }
            }

            // 4. Duplicate Check
            $isDuplicate = false;
            $duplicateReason = null;

            if ($email !== '' && empty($errors)) {
                if (isset($existingDbEmails[$email])) {
                    $isDuplicate = true;
                    $duplicateReason = "Customer with email '{$email}' already exists in database.";
                } elseif (isset($seenEmails[$email])) {
                    $isDuplicate = true;
                    $duplicateReason = "Duplicate email '{$email}' in CSV (first occurrence on Row {$seenEmails[$email]}).";
                } else {
                    $seenEmails[$email] = $rowNumber;
                }
            }

            // Build Row Result
            $rowSummary = [
                'row_number' => $rowNumber,
                'name' => $displayName,
                'company' => $companyName,
                'email' => $email,
                'phone' => $phone,
                'street_address' => $streetAddress,
                'city_suburb' => $citySuburb,
                'state' => $normalizedState ?: $stateRaw,
                'postcode' => $cleanPostcode ?: $postcodeRaw,
                'country' => $normalizedCountry,
            ];

            if (!empty($errors)) {
                $invalidItem = array_merge($rowSummary, [
                    'status' => 'invalid',
                    'errors' => $errors,
                    'reason' => implode(' | ', $errors),
                ]);
                $invalid[] = $invalidItem;
                $previewItems[] = $invalidItem;
            } elseif ($isDuplicate) {
                if ($skipDuplicates) {
                    $skippedItem = array_merge($rowSummary, [
                        'status' => 'skipped',
                        'reason' => $duplicateReason,
                        'errors' => [],
                    ]);
                    $skipped[] = $skippedItem;
                    $previewItems[] = $skippedItem;
                } else {
                    $invalidItem = array_merge($rowSummary, [
                        'status' => 'invalid',
                        'errors' => [$duplicateReason],
                        'reason' => $duplicateReason,
                    ]);
                    $invalid[] = $invalidItem;
                    $previewItems[] = $invalidItem;
                }
            } else {
                $validItem = [
                    'row_number' => $rowNumber,
                    'status' => 'valid',
                    'customer' => [
                        'name' => $displayName,
                        'email' => $email,
                        'phone' => $phone ?: null,
                        'company_name' => $companyName ?: null,
                    ],
                    'address' => $addressData,
                ];
                $valid[] = $validItem;
                $previewItems[] = array_merge($rowSummary, [
                    'status' => 'valid',
                    'errors' => [],
                    'reason' => 'Ready for import',
                ]);
            }
        }

        return [
            'valid' => $valid,
            'skipped' => $skipped,
            'invalid' => $invalid,
            'preview_items' => $previewItems,
        ];
    }

    /**
     * Get mapped column value from raw row.
     */
    protected function getMappedValue(array $rawRow, array $mapping, string $fieldKey): string
    {
        $headerName = $mapping[$fieldKey] ?? null;
        if ($headerName && isset($rawRow[$headerName])) {
            return trim((string) $rawRow[$headerName]);
        }
        return '';
    }

    /**
     * Normalize Australian State to 2-3 letter standard code.
     */
    public function normalizeAustralianState(?string $state): ?string
    {
        if (empty($state)) {
            return null;
        }

        $clean = strtolower(trim($state));
        $clean = preg_replace('/\s+/', ' ', $clean);

        if (isset(self::STATE_MAPPINGS[$clean])) {
            return self::STATE_MAPPINGS[$clean];
        }

        $upper = strtoupper($clean);
        if (in_array($upper, self::VALID_AU_STATES, true)) {
            return $upper;
        }

        return null;
    }

    /**
     * Normalize country to "AU" if Australia, otherwise 2-letter uppercase code.
     */
    public function normalizeCountry(?string $country): string
    {
        if (empty($country)) {
            return 'AU';
        }

        $clean = strtolower(trim($country));
        if (in_array($clean, ['australia', 'au', 'aus', 'australian', 'commonwealth of australia'], true)) {
            return 'AU';
        }

        if (strlen($clean) === 2) {
            return strtoupper($clean);
        }

        return 'AU';
    }

    /**
     * Validate 4-digit Australian postcode and optional state alignment.
     */
    public function isValidAustralianPostcode(string $postcode, ?string $state = null): bool
    {
        if (!preg_match('/^[0-9]{4}$/', $postcode)) {
            return false;
        }

        $pc = (int) $postcode;

        // Valid Australian numeric postcode spans
        $isAuSpan =
            ($pc >= 200 && $pc <= 299) ||
            ($pc >= 800 && $pc <= 999) ||
            ($pc >= 1000 && $pc <= 2599) ||
            ($pc >= 2600 && $pc <= 2920) ||
            ($pc >= 2921 && $pc <= 2999) ||
            ($pc >= 3000 && $pc <= 3999) ||
            ($pc >= 4000 && $pc <= 4999) ||
            ($pc >= 5000 && $pc <= 5999) ||
            ($pc >= 6000 && $pc <= 6999) ||
            ($pc >= 7000 && $pc <= 7999) ||
            ($pc >= 8000 && $pc <= 9999);

        if (!$isAuSpan) {
            return false;
        }

        if ($state) {
            $stateUpper = strtoupper(trim($state));
            return match ($stateUpper) {
                'NSW' => ($pc >= 1000 && $pc <= 2599) || ($pc >= 2619 && $pc <= 2899) || ($pc >= 2921 && $pc <= 2999),
                'ACT' => ($pc >= 200 && $pc <= 299) || ($pc >= 2600 && $pc <= 2618) || ($pc >= 2900 && $pc <= 2920),
                'VIC' => ($pc >= 3000 && $pc <= 3999) || ($pc >= 8000 && $pc <= 8999),
                'QLD' => ($pc >= 4000 && $pc <= 4999) || ($pc >= 9000 && $pc <= 9999),
                'SA'  => ($pc >= 5000 && $pc <= 5999),
                'WA'  => ($pc >= 6000 && $pc <= 6999),
                'TAS' => ($pc >= 7000 && $pc <= 7999),
                'NT'  => ($pc >= 800 && $pc <= 999),
                default => true,
            };
        }

        return true;
    }

    /**
     * Generate downloadable CSV report of skipped and invalid rows.
     */
    public function generateReportCsv(array $reportRows): string
    {
        $output = fopen('php://temp', 'r+');

        // CSV Header
        fputcsv($output, [
            'Row Number',
            'Status',
            'Name',
            'Company',
            'Email',
            'Phone',
            'Street Address',
            'City/Suburb',
            'State',
            'Postcode',
            'Country',
            'Reason',
        ]);

        foreach ($reportRows as $row) {
            fputcsv($output, [
                $row['row_number'] ?? '',
                strtoupper($row['status'] ?? 'ERROR'),
                $row['name'] ?? '',
                $row['company'] ?? '',
                $row['email'] ?? '',
                $row['phone'] ?? '',
                $row['street_address'] ?? '',
                $row['city_suburb'] ?? '',
                $row['state'] ?? '',
                $row['postcode'] ?? '',
                $row['country'] ?? 'AU',
                $row['reason'] ?? (isset($row['errors']) ? implode(' | ', $row['errors']) : ''),
            ]);
        }

        rewind($output);
        $csvContent = stream_get_contents($output);
        fclose($output);

        return $csvContent;
    }
}
