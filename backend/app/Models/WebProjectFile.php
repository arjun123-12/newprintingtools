<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebProjectFile extends Model
{
    protected $fillable = ['project_id', 'uploaded_by', 'original_name', 'file_path', 'mime_type', 'size_bytes'];
}
