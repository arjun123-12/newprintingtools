"use client";

import React, { useState } from 'react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1';

interface ProductImageUploaderProps {
  productId: string;
}

export default function ProductImageUploader({ productId }: ProductImageUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMessage('Please select an image to upload.');
      return;
    }

    setLoading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('image', file);
    formData.append('alt_text', altText);
    formData.append('is_featured', isFeatured ? '1' : '0');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/products/${productId}/images`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (response.ok) {
        setMessage('Image uploaded successfully!');
        setFile(null);
        setAltText('');
        setIsFeatured(false);
      } else {
        const data = await response.json();
        setMessage(data.message || 'Error uploading image.');
      }
    } catch (error) {
      setMessage('Network error during upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mt-6 max-w-4xl mx-auto">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Upload Product Image</h3>

      {message && (
        <div className={`p-3 mb-4 rounded-lg text-sm ${message.includes('success') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Image File</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange} 
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alt Text</label>
          <input 
            type="text" 
            value={altText} 
            onChange={(e) => setAltText(e.target.value)} 
            placeholder="Description of the image"
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input 
            type="checkbox" 
            id="is_featured" 
            checked={isFeatured} 
            onChange={(e) => setIsFeatured(e.target.checked)} 
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="is_featured" className="text-sm font-medium text-gray-700">Set as Featured Image</label>
        </div>

        <div className="pt-2">
          <button 
            type="submit" 
            disabled={loading || !file} 
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Uploading...' : 'Upload Image'}
          </button>
        </div>
      </form>
    </div>
  );
}
