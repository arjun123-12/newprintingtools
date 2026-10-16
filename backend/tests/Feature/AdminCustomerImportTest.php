<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserAddress;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminCustomerImportTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $authorizedStaff;
    protected User $unauthorizedStaff;
    protected User $inactiveStaff;
    protected User $customerUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::create([
            'name' => 'Super Administrator',
            'email' => 'superadmin@example.com',
            'password' => Hash::make('secret123'),
            'role' => 'admin',
            'is_super_admin' => true,
            'is_active' => true,
        ]);

        $this->authorizedStaff = User::create([
            'name' => 'Customer Operations Staff',
            'email' => 'staff.cust@example.com',
            'password' => Hash::make('secret123'),
            'role' => 'staff',
            'permissions' => ['customers'],
            'is_super_admin' => false,
            'is_active' => true,
        ]);

        $this->unauthorizedStaff = User::create([
            'name' => 'Production Staff',
            'email' => 'staff.prod@example.com',
            'password' => Hash::make('secret123'),
            'role' => 'staff',
            'permissions' => ['artwork', 'orders'], // No customers permission
            'is_super_admin' => false,
            'is_active' => true,
        ]);

        $this->inactiveStaff = User::create([
            'name' => 'Inactive Staff',
            'email' => 'inactive.staff@example.com',
            'password' => Hash::make('secret123'),
            'role' => 'staff',
            'permissions' => ['customers'],
            'is_super_admin' => false,
            'is_active' => false,
        ]);

        $this->customerUser = User::create([
            'name' => 'Regular Customer',
            'email' => 'customer@example.com',
            'password' => Hash::make('secret123'),
            'role' => 'customer',
            'is_super_admin' => false,
            'is_active' => true,
        ]);
    }

    /**
     * Helper to create a fake CSV UploadedFile from string.
     */
    protected function createCsvFile(string $content, string $filename = 'customers.csv'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($filename, $content);
    }

    /*
    |--------------------------------------------------------------------------
    | Authorization Tests
    |--------------------------------------------------------------------------
    */

    public function test_unauthenticated_request_is_denied(): void
    {
        $response = $this->postJson('/api/v1/admin/customers/import/preview', [
            'csv_content' => "Name,Email\nJane,jane@example.com",
        ]);

        $response->assertStatus(401);
    }

    public function test_customer_user_cannot_access_import(): void
    {
        Sanctum::actingAs($this->customerUser);

        $response = $this->postJson('/api/v1/admin/customers/import/preview', [
            'csv_content' => "Name,Email\nJane,jane@example.com",
        ]);

        $response->assertStatus(403);
    }

    public function test_inactive_staff_is_denied(): void
    {
        Sanctum::actingAs($this->inactiveStaff);

        $response = $this->postJson('/api/v1/admin/customers/import/preview', [
            'csv_content' => "Name,Email\nJane,jane@example.com",
        ]);

        $response->assertStatus(403);
    }

    public function test_staff_without_customers_permission_is_denied(): void
    {
        Sanctum::actingAs($this->unauthorizedStaff);

        $response = $this->postJson('/api/v1/admin/customers/import/preview', [
            'csv_content' => "Name,Email\nJane,jane@example.com",
        ]);

        $response->assertStatus(403);
        $response->assertJson([
            'success' => false,
            'message' => 'Access denied. You do not have permission to access this section.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Preview & Validation Tests
    |--------------------------------------------------------------------------
    */

    public function test_authorized_staff_can_preview_valid_csv(): void
    {
        Sanctum::actingAs($this->authorizedStaff);

        $csv = "Name,Company name,Street Address,City/Suburb,State,Country,Postcode,Phone,Email\n"
             . "Alice Smith,Acme Print,123 George St,Sydney,NSW,Australia,2000,0412345678,alice@example.com\n"
             . "Bob Jones,Apex Signs,456 Collins St,Melbourne,Victoria,AU,3000,0498765432,bob@example.com";

        $response = $this->postJson('/api/v1/admin/customers/import/preview', [
            'csv_content' => $csv,
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'total_rows' => 2,
                'valid_count' => 2,
                'skipped_count' => 0,
                'invalid_count' => 0,
            ],
        ]);

        $previewRows = $response->json('data.preview_rows');
        $this->assertCount(2, $previewRows);
        $this->assertEquals('valid', $previewRows[0]['status']);
        $this->assertEquals('alice@example.com', $previewRows[0]['email']);
        $this->assertEquals('NSW', $previewRows[0]['state']);
        $this->assertEquals('AU', $previewRows[0]['country']);

        // Victoria normalized to VIC
        $this->assertEquals('VIC', $previewRows[1]['state']);
        $this->assertEquals('AU', $previewRows[1]['country']);
    }

    public function test_preview_validates_required_fields_and_formats(): void
    {
        Sanctum::actingAs($this->authorizedStaff);

        $csv = "Name,Company name,Street Address,City/Suburb,State,Country,Postcode,Phone,Email\n"
             . ",,10 King St,Brisbane,QLD,Australia,4000,0400000000,valid@example.com\n" // Missing both name & company
             . "Charlie Brown,Peanuts Ltd,10 King St,Brisbane,QLD,Australia,4000,0400000000,not-an-email\n" // Invalid email
             . "David Miller,Miller Tech,20 North Tce,Adelaide,SA,Australia,99999,0400000000,david@example.com\n" // Invalid 5-digit postcode
             . "Emma Wilson,Wilson Design,30 Hay St,Perth,California,Australia,6000,0400000000,emma@example.com\n" // Invalid state
             . "Frank White,White & Co,40 St Georges,Perth,WA,Australia,2000,0400000000,frank@example.com"; // Postcode 2000 does not match WA

        $response = $this->postJson('/api/v1/admin/customers/import/preview', [
            'csv_content' => $csv,
        ]);

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertEquals(5, $data['total_rows']);
        $this->assertEquals(0, $data['valid_count']);
        $this->assertEquals(5, $data['invalid_count']);

        $invalidRows = $data['invalid_rows'];
        $this->assertStringContainsString('Customer Name or Company Name is required', $invalidRows[0]['reason']);
        $this->assertStringContainsString('Invalid email address format', $invalidRows[1]['reason']);
        $this->assertStringContainsString('must be a 4-digit Australian postcode', $invalidRows[2]['reason']);
        $this->assertStringContainsString('Invalid Australian state', $invalidRows[3]['reason']);
        $this->assertStringContainsString('does not match Australian state WA', $invalidRows[4]['reason']);
    }

    public function test_auto_pads_three_digit_postcodes_for_northern_territory(): void
    {
        Sanctum::actingAs($this->authorizedStaff);

        // Darwin postcodes like 0800 often lose the leading 0 in Excel CSV exports
        $csv = "Name,Company name,Street Address,City/Suburb,State,Country,Postcode,Phone,Email\n"
             . "George Darwin,Top End Prints,15 Mitchell St,Darwin,NT,Australia,800,0411223344,darwin@example.com";

        $response = $this->postJson('/api/v1/admin/customers/import/preview', [
            'csv_content' => $csv,
        ]);

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertEquals(1, $data['valid_count']);
        $this->assertEquals('0800', $data['preview_rows'][0]['postcode']);
        $this->assertEquals('NT', $data['preview_rows'][0]['state']);
    }

    public function test_ignores_open_balance_and_attachments_count_columns(): void
    {
        Sanctum::actingAs($this->authorizedStaff);

        $csv = "Name,Company name,Street Address,City/Suburb,State,Country,Postcode,Phone,Email,Open balance,Attachments\n"
             . "Hannah Green,Green Signs,10 High St,Hobart,TAS,Australia,7000,0422334455,hannah@example.com,$1500.00,4";

        $response = $this->postJson('/api/v1/admin/customers/import/preview', [
            'csv_content' => $csv,
        ]);

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertEquals(1, $data['valid_count']);
        $this->assertEquals(0, $data['invalid_count']);
    }

    public function test_skips_duplicate_emails_and_in_file_duplicates(): void
    {
        Sanctum::actingAs($this->authorizedStaff);

        // Create an existing customer in DB
        User::create([
            'name' => 'Existing Cust',
            'email' => 'existing@example.com',
            'password' => Hash::make('secret'),
            'role' => 'customer',
        ]);

        $csv = "Name,Company name,Street Address,City/Suburb,State,Country,Postcode,Phone,Email\n"
             . "Duplicate Person,Dup Co,10 Street,Sydney,NSW,AU,2000,0400000000,existing@example.com\n" // Matches DB
             . "First New,New Co,20 Street,Sydney,NSW,AU,2000,0400000000,unique@example.com\n" // First in file
             . "Second New,New Co,30 Street,Sydney,NSW,AU,2000,0400000000,unique@example.com"; // Duplicate in file

        $response = $this->postJson('/api/v1/admin/customers/import/preview', [
            'csv_content' => $csv,
            'skip_duplicates' => true,
        ]);

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertEquals(3, $data['total_rows']);
        $this->assertEquals(1, $data['valid_count']);
        $this->assertEquals(2, $data['skipped_count']);
        $this->assertEquals(0, $data['invalid_count']);

        $skipped = $data['skipped_rows'];
        $this->assertStringContainsString('already exists in database', $skipped[0]['reason']);
        $this->assertStringContainsString('Duplicate email', $skipped[1]['reason']);
        $this->assertStringContainsString('Row 3', $skipped[1]['reason']);
    }

    /*
    |--------------------------------------------------------------------------
    | Import Execution Tests
    |--------------------------------------------------------------------------
    */

    public function test_executes_import_and_creates_users_and_addresses(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $csv = "Name,Company name,Street Address,City/Suburb,State,Country,Postcode,Phone,Email\n"
             . "Sarah Connor,Cyberdyne Signs,742 Evergreen Tce,Springfield,NSW,Australia,2650,0412999888,sarah@cyberdyne.com\n"
             . "John Matrix,Commando Print,1 Val Verde St,Brisbane,Queensland,Australia,4000,0499888777,john@matrix.com";

        $response = $this->postJson('/api/v1/admin/customers/import', [
            'csv_content' => $csv,
            'skip_duplicates' => true,
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'imported_count' => 2,
            'skipped_count' => 0,
            'invalid_count' => 0,
        ]);

        // Check Sarah user & address
        $userSarah = User::where('email', 'sarah@cyberdyne.com')->first();
        $this->assertNotNull($userSarah);
        $this->assertEquals('Sarah Connor', $userSarah->name);
        $this->assertEquals('Cyberdyne Signs', $userSarah->company_name);
        $this->assertEquals('customer', $userSarah->role);
        $this->assertFalse((bool) $userSarah->is_super_admin);
        $this->assertTrue((bool) $userSarah->is_active);

        $addressSarah = $userSarah->addresses()->first();
        $this->assertNotNull($addressSarah);
        $this->assertEquals('742 Evergreen Tce', $addressSarah->address_line_1);
        $this->assertEquals('Springfield', $addressSarah->suburb);
        $this->assertEquals('NSW', $addressSarah->state);
        $this->assertEquals('2650', $addressSarah->postcode);
        $this->assertEquals('AU', $addressSarah->country);
        $this->assertEquals('0412999888', $addressSarah->phone);
        $this->assertEquals('shipping', $addressSarah->type);

        // Check John user & address (converted "Queensland" to "QLD" and "Australia" to "AU")
        $userJohn = User::where('email', 'john@matrix.com')->first();
        $this->assertNotNull($userJohn);
        $this->assertEquals('QLD', $userJohn->addresses()->first()->state);
        $this->assertEquals('AU', $userJohn->addresses()->first()->country);
    }

    public function test_import_with_partial_errors_and_skipped_duplicates_produces_report(): void
    {
        Sanctum::actingAs($this->superAdmin);

        // Pre-create existing customer
        User::create([
            'name' => 'Existing Client',
            'email' => 'client@existing.com',
            'password' => Hash::make('secret'),
            'role' => 'customer',
        ]);

        $csv = "Name,Company name,Street Address,City/Suburb,State,Country,Postcode,Phone,Email\n"
             . "Valid User,Valid Co,100 Pitt St,Sydney,NSW,Australia,2000,0400111222,valid.import@example.com\n"
             . "Existing Client,Existing Co,200 Pitt St,Sydney,NSW,Australia,2000,0400111222,client@existing.com\n" // Duplicate DB
             . "Invalid Postcode,Bad Co,300 Pitt St,Sydney,NSW,Australia,99999,0400111222,bad.postcode@example.com"; // Invalid postcode

        $response = $this->postJson('/api/v1/admin/customers/import', [
            'csv_content' => $csv,
            'skip_duplicates' => true,
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'imported_count' => 1,
            'skipped_count' => 1,
            'invalid_count' => 1,
        ]);

        // Only valid user was inserted
        $this->assertDatabaseHas('users', ['email' => 'valid.import@example.com']);
        $this->assertDatabaseMissing('users', ['email' => 'bad.postcode@example.com']);

        // Check report CSV contains the skipped and invalid rows
        $reportCsv = $response->json('report_csv');
        $this->assertNotEmpty($reportCsv);
        $this->assertStringContainsString('Status,Name,Company,Email', $reportCsv);
        $this->assertStringContainsString('client@existing.com', $reportCsv);
        $this->assertStringContainsString('SKIPPED', $reportCsv);
        $this->assertStringContainsString('bad.postcode@example.com', $reportCsv);
        $this->assertStringContainsString('INVALID', $reportCsv);
    }

    public function test_download_report_endpoint_streams_csv(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $reportCsv = "Row Number,Status,Name,Company,Email,Phone,Street Address,City/Suburb,State,Postcode,Country,Reason\n"
                   . "2,SKIPPED,Dup Name,Dup Co,dup@example.com,0400000000,10 St,Sydney,NSW,2000,AU,Customer with email already exists";

        $response = $this->post('/api/v1/admin/customers/import/download-report', [
            'report_csv' => $reportCsv,
        ]);

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('attachment; filename="customer-import-report-', $response->headers->get('Content-Disposition'));
        $this->assertEquals($reportCsv, $response->getContent());
    }
}
