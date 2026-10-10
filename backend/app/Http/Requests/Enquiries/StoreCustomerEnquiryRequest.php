<?php

namespace App\Http\Requests\Enquiries;

use Illuminate\Foundation\Http\FormRequest;

class StoreCustomerEnquiryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Required contact fields
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],

            // Product context
            'product_id' => ['nullable', 'string', 'max:255'],
            'product_name' => ['nullable', 'string', 'max:255'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:10000000'],

            // Printing specifications
            'specifications' => ['nullable'], // array or json string
            'specifications.size' => ['nullable', 'string', 'max:100'],
            'specifications.gsm' => ['nullable', 'string', 'max:100'],
            'specifications.paper_stock' => ['nullable', 'string', 'max:150'],
            'specifications.printing_sides' => ['nullable', 'string', 'max:100'],
            'specifications.finishing' => ['nullable', 'string', 'max:200'],
            'specifications.folding' => ['nullable', 'string', 'max:150'],

            // Delivery & Notes
            'delivery_location' => ['nullable', 'string', 'max:255'],
            'additional_requirements' => ['nullable', 'string', 'max:10000'],
            'source_url' => ['nullable', 'string', 'max:1000'],

            // Privacy consent
            'privacy_consent' => ['accepted'],

            // Optional secure file upload
            'attachment' => [
                'nullable',
                'file',
                'max:26214', // 25MB
                'mimes:pdf,png,jpg,jpeg,webp,ai,eps,psd,tif,tiff',
            ],

            // Anti-spam honeypot (must be empty)
            'hp_company_website' => ['nullable', 'max:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Please provide your full name.',
            'email.required' => 'Please provide a valid email address.',
            'email.email' => 'Please provide a valid email address format.',
            'privacy_consent.accepted' => 'You must agree to the privacy policy to submit an enquiry.',
            'attachment.max' => 'Attachment file size must not exceed 25MB.',
            'attachment.mimes' => 'Attachment must be a valid document or print artwork file (PDF, PNG, JPG, WebP, AI, EPS, PSD, TIFF).',
            'hp_company_website.max' => 'Spam submission detected.',
        ];
    }
}
