<?php

namespace App\Http\Requests\Enquiries;

use App\Models\CustomerEnquiry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCustomerEnquiryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && $this->user()->isAdmin();
    }

    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'required', 'string', Rule::in(CustomerEnquiry::STATUSES)],
            'admin_notes' => ['nullable', 'string', 'max:10000'],
        ];
    }
}
