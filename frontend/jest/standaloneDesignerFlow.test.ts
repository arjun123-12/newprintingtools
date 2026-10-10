import { createTemplateDraft } from '../src/services/designTemplateService';
import {
  DEFAULT_PAPER_STOCKS,
  getStandaloneDesignerOptions,
  shouldFetchProductConfiguration,
} from '../src/components/designer/controls/standaloneDesignerOptions';

describe('Standalone Designer Flow', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('sanitizes product_id "default" to null when saving a template draft', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            id: 'tpl-123',
            product_id: null,
            name: 'Standalone Test Template',
          },
        }),
    });

    const result = await createTemplateDraft({
      name: 'Standalone Test Template',
      product_id: 'default',
      width_mm: 90,
      height_mm: 50,
      print_sides: 'front',
      canvas_json: { version: '6.0.0', objects: [] },
      is_active: false,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const parsedBody = JSON.parse(options.body);

    // Crucial: product_id must be null, never literal "default"
    expect(parsedBody.product_id).toBeNull();
    expect(result.product_id).toBeNull();
  });

  it('preserves valid product UUID when saving a product-linked template', async () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            id: 'tpl-456',
            product_id: validUuid,
            name: 'Product Linked Template',
          },
        }),
    });

    const result = await createTemplateDraft({
      name: 'Product Linked Template',
      product_id: validUuid,
      width_mm: 148,
      height_mm: 210,
      print_sides: 'both',
      canvas_json: { version: '6.0.0', objects: [] },
      is_active: false,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const parsedBody = JSON.parse(options.body);

    expect(parsedBody.product_id).toBe(validUuid);
    expect(result.product_id).toBe(validUuid);
  });

  it('correctly decides whether to fetch product configuration based on productId', () => {
    // When productId is "default", null, or empty, do NOT call GET /api/v1/products/default
    expect(shouldFetchProductConfiguration('default')).toBe(false);
    expect(shouldFetchProductConfiguration(null)).toBe(false);
    expect(shouldFetchProductConfiguration(undefined)).toBe(false);
    expect(shouldFetchProductConfiguration('')).toBe(false);

    // Real product UUIDs or slugs must trigger the product fetch
    expect(shouldFetchProductConfiguration('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(shouldFetchProductConfiguration('business-card-standard')).toBe(true);
  });

  it('initializes default paper-stock options and empty printing/folding options for standalone flow', () => {
    const options = getStandaloneDesignerOptions();

    // Verify paper stocks initialize to the existing standard paper stocks
    expect(options.gsmOptions).toEqual(DEFAULT_PAPER_STOCKS);
    expect(options.gsmOptions.length).toBe(3);
    expect(options.defaultGsmId).toBe('gsm_128');

    // Printing options must be empty for standalone flow
    expect(options.printingOptions).toEqual([]);
    expect(options.defaultPrintingSide).toBe('');

    // Folding options must be empty and default to 'no_fold'
    expect(options.foldingOptions).toEqual([]);
    expect(options.defaultFolding).toBe('no_fold');
  });
});
