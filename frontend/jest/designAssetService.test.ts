import { designAssetService } from '../src/services/designAssetService';
import { apiClient as api } from '../src/services/api/client';

jest.mock('../src/services/api/client', () => {
  return {
    apiClient: {
      post: jest.fn(),
      get: jest.fn(),
    },
  };
});

describe('DesignAssetService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should build FormData with file fields for frame upload', async () => {
    const mockFile = new File(['dummy'], 'mask.png', { type: 'image/png' });
    const data = {
      name: 'Test Frame',
      asset_type: 'frame' as const,
      mask_file: mockFile,
      thumbnail: mockFile,
      metadata: { shape: 'rectangle', width: 200, height: 200 },
    };

    // mock response
    (api.post as any).mockResolvedValue({ data: { data: { id: '123' } } });

    const result = await designAssetService.createAsset(data);

    expect(api.post).toHaveBeenCalledTimes(1);
    const [url, formData, config] = (api.post as any).mock.calls[0];
    expect(url).toBe('/admin/designer/assets');
    // Verify FormData contains our fields
    expect((formData as FormData).get('name')).toBe('Test Frame');
    expect((formData as FormData).get('asset_type')).toBe('frame');
    expect((formData as FormData).get('mask_file')).toBe(mockFile);
    expect((formData as FormData).get('thumbnail')).toBe(mockFile);
    expect((formData as FormData).get('metadata')).toBe(JSON.stringify(data.metadata));
    expect(config?.headers?.['Content-Type']).toBe('multipart/form-data');
    expect(result).toEqual({ id: '123' });
  });

  it('should fetch public assets (frames) correctly', async () => {
    const mockResponse = {
      data: { data: [{ id: '1', asset_type: 'frame', name: 'Sample Frame' }] },
    };
    (api.get as any).mockResolvedValue(mockResponse);
    const assets = await designAssetService.getPublicAssets({ asset_type: 'frame' });
    expect(api.get).toHaveBeenCalledWith('/designer/assets', { params: { asset_type: 'frame' } });
    expect(assets).toEqual(mockResponse.data);
  });
});
