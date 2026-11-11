<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WebDevelopmentProject as Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WebDevelopmentProjectController extends Controller
{
    private const SERVICES = ['website_design', 'development', 'redesign', 'hosting', 'domain', 'maintenance', 'seo', 'ecommerce'];
    private const ADDONS = ['business_email', 'ssl_security', 'backup', 'seo', 'analytics', 'payment_gateway', 'content_writing', 'speed_optimization'];

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_name' => ['required', 'string', 'max:120'], 'company_name' => ['nullable', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:190'], 'phone' => ['nullable', 'string', 'max:50'],
            'project_name' => ['required', 'string', 'max:160'],
            'services' => ['required', 'array', 'min:1'], 'services.*' => ['required', 'in:' . implode(',', self::SERVICES)],
            'website_type' => ['nullable', 'string', 'max:80'], 'reference_urls' => ['nullable', 'string', 'max:5000'],
            'requirements' => ['required', 'string', 'max:12000'], 'budget_range' => ['nullable', 'string', 'max:80'],
            'requested_deadline' => ['nullable', 'date', 'after_or_equal:today'],
            'infrastructure' => ['nullable', 'array'],
            'infrastructure.hosting_status' => ['nullable', 'in:already_have,need,not_sure'],
            'infrastructure.hosting_provider' => ['nullable', 'string', 'max:160'],
            'infrastructure.domain_status' => ['nullable', 'in:already_have,need_purchase,not_sure'],
            'infrastructure.domain_name' => ['nullable', 'string', 'max:253'],
            'infrastructure.addons' => ['nullable', 'array'],
            'infrastructure.addons.*' => ['required', 'in:' . implode(',', self::ADDONS)],
        ]);
        $project = Project::create([...$data, 'token' => Str::random(56), 'status' => 'new']);
        return response()->json(['success' => true, 'message' => 'Website project enquiry received.', 'data' => ['id' => $project->id, 'token' => $project->token]], 201);
    }

    public function publicShow(string $token): JsonResponse
    {
        $project = Project::with(['developer:id,name,email', 'messages' => fn ($q) => $q->orderBy('id'), 'files' => fn ($q) => $q->latest()])->where('token', $token)->firstOrFail();
        return response()->json(['success' => true, 'data' => $this->payload($project, false)]);
    }

    public function publicMessage(Request $request, string $token): JsonResponse
    {
        $data = $request->validate(['message' => ['required', 'string', 'max:5000']]);
        $project = Project::where('token', $token)->firstOrFail();
        $project->messages()->create(['author_type' => 'customer', 'message' => $data['message']]);
        return response()->json(['success' => true, 'message' => 'Message sent.']);
    }

    public function publicFile(Request $request, string $token): JsonResponse
    {
        return $this->storeFile($request, Project::where('token', $token)->firstOrFail(), null);
    }

    public function acceptQuote(string $token): JsonResponse
    {
        $project = Project::where('token', $token)->firstOrFail();
        abort_unless($project->quote_amount !== null, 422, 'There is no quote to approve yet.');
        $project->update(['quote_accepted_at' => now(), 'status' => 'active']);
        $project->messages()->create(['author_type' => 'customer', 'message' => 'Customer approved the project quote.']);
        return response()->json(['success' => true, 'message' => 'Quote approved. The project is now active.']);
    }

    public function index(): JsonResponse
    {
        $items = Project::with('developer:id,name')->withCount(['messages', 'files'])->latest()->paginate(50);
        return response()->json(['success' => true, 'data' => $items]);
    }

    public function show(int $id): JsonResponse
    {
        $project = Project::with(['developer:id,name,email', 'messages' => fn ($q) => $q->orderBy('id'), 'files' => fn ($q) => $q->latest()])->findOrFail($id);
        return response()->json(['success' => true, 'data' => $this->payload($project, true)]);
    }

    public function developers(): JsonResponse
    {
        $users = \App\Models\User::query()->where('is_active', true)->whereIn('role', ['staff', 'admin', 'super_admin'])->orderBy('name')->get(['id', 'name', 'email', 'role']);
        return response()->json(['success' => true, 'data' => $users]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $project = Project::findOrFail($id);
        $data = $request->validate([
            'assigned_to' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'status' => ['sometimes', 'in:new,review,quoted,active,design_review,revision,completed,cancelled'],
            'quote_amount' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:1000000'],
            'quote_scope' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'admin_notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'milestones' => ['sometimes', 'array', 'max:30'],
            'milestones.*.title' => ['required', 'string', 'max:160'], 'milestones.*.status' => ['required', 'in:pending,in_progress,review,completed'],
            'milestones.*.due_date' => ['nullable', 'date'],
            'hosting_details' => ['sometimes', 'array'], 'hosting_details.provider' => ['nullable', 'string', 'max:160'],
            'hosting_details.domain' => ['nullable', 'string', 'max:253'], 'hosting_details.renewal_date' => ['nullable', 'date'],
            'hosting_details.maintenance_plan' => ['nullable', 'string', 'max:500'], 'hosting_details.notes' => ['nullable', 'string', 'max:2000'],
        ]);
        if (array_key_exists('quote_amount', $data) && $data['quote_amount'] !== null) $data['quote_accepted_at'] = null;
        $project->update($data);
        return response()->json(['success' => true, 'data' => $this->payload($project->fresh(['developer', 'messages', 'files']), true)]);
    }

    public function adminMessage(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['message' => ['required', 'string', 'max:5000']]);
        $project = Project::findOrFail($id);
        $type = $project->assigned_to === $request->user()->id ? 'developer' : 'admin';
        $project->messages()->create(['author_id' => $request->user()->id, 'author_type' => $type, 'message' => $data['message']]);
        return response()->json(['success' => true, 'message' => 'Message sent.']);
    }

    public function adminFile(Request $request, int $id): JsonResponse
    {
        return $this->storeFile($request, Project::findOrFail($id), $request->user()->id);
    }

    private function storeFile(Request $request, Project $project, ?int $userId): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'max:20480', 'mimes:pdf,png,jpg,jpeg,webp,svg,zip,txt,doc,docx']]);
        $file = $request->file('file');
        $path = $file->store('web-projects/' . $project->id, 'public');
        $row = $project->files()->create(['uploaded_by' => $userId, 'original_name' => $file->getClientOriginalName(), 'file_path' => $path, 'mime_type' => $file->getMimeType(), 'size_bytes' => $file->getSize()]);
        return response()->json(['success' => true, 'data' => ['id' => $row->id]], 201);
    }

    private function payload(Project $project, bool $admin): array
    {
        $data = $project->toArray();
        unset($data['token']);
        if ($admin) $data['token'] = $project->token;
        $data['messages'] = $project->messages->map(fn ($m) => ['id' => $m->id, 'author_type' => $m->author_type, 'author_name' => $m->author?->name ?? ($m->author_type === 'customer' ? $project->client_name : 'Team'), 'message' => $m->message, 'created_at' => $m->created_at]);
        $data['files'] = $project->files->map(fn ($f) => ['id' => $f->id, 'name' => $f->original_name, 'url' => url('/storage/' . $f->file_path), 'size_bytes' => $f->size_bytes]);
        if (!$admin) unset($data['admin_notes']);
        return $data;
    }
}
