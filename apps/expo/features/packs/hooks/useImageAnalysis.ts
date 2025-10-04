import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

export interface DetectedItem {
  name: string;
  description: string;
  category: string;
  confidence: number;
  brand?: string;
  model?: string;
  color?: string;
  material?: string;
  vectorSearchResults?: VectorSearchResult[];
}

export interface VectorSearchResult {
  id: string;
  name: string;
  description: string;
  brand?: string;
  category?: string;
  similarity: number;
  price?: number;
  imageUrl?: string;
}

export interface ImageAnalysisResult {
  success: boolean;
  items: DetectedItem[];
  totalItemsFound: number;
  analysisConfidence: number;
  processingTimeMs: number;
}

export function useImageAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);

  const analyzeImage = useCallback(async (imageUrl: string): Promise<ImageAnalysisResult | null> => {
    if (!imageUrl) {
      Alert.alert('Error', 'No image URL provided for analysis');
      return null;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // TODO: Replace with proper API endpoint once authentication is set up
      const apiEndpoint = 'http://localhost:8787/api/catalog/analyze-image';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication header when available
          // 'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          imageUrl,
          includeVectorSearch: true,
          vectorSearchLimit: 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result: ImageAnalysisResult = await response.json();
      
      if (!result.success) {
        throw new Error('Image analysis was not successful');
      }

      setAnalysisResult(result);
      return result;
    } catch (error) {
      console.error('Image analysis error:', error);
      Alert.alert(
        'Analysis Failed',
        error instanceof Error ? error.message : 'Failed to analyze image. Please try again.',
      );
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysisResult(null);
  }, []);

  return {
    isAnalyzing,
    analysisResult,
    analyzeImage,
    clearAnalysis,
  };
}

// Mock function for testing without API
export function useMockImageAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);

  const analyzeImage = useCallback(async (imageUrl: string): Promise<ImageAnalysisResult | null> => {
    setIsAnalyzing(true);
    setAnalysisResult(null);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock analysis result
    const mockResult: ImageAnalysisResult = {
      success: true,
      items: [
        {
          name: 'Hiking Backpack',
          description: 'Large outdoor backpack with multiple compartments',
          category: 'Backpacks & Bags',
          confidence: 0.92,
          brand: 'Osprey',
          color: 'Navy Blue',
          vectorSearchResults: [
            {
              id: '1',
              name: 'Osprey Atmos AG 65 Backpack',
              description: 'Anti-Gravity suspension hiking backpack',
              brand: 'Osprey',
              category: 'Backpacks & Bags',
              similarity: 0.95,
              price: 299.99,
            },
            {
              id: '2',
              name: 'Gregory Baltoro 65 Backpack',
              description: 'Multi-day hiking backpack with adjustable torso',
              brand: 'Gregory',
              category: 'Backpacks & Bags',
              similarity: 0.87,
              price: 279.99,
            },
          ],
        },
        {
          name: 'Water Bottle',
          description: 'Insulated stainless steel water bottle',
          category: 'Cooking & Hydration',
          confidence: 0.88,
          brand: 'Hydro Flask',
          color: 'Blue',
          vectorSearchResults: [
            {
              id: '3',
              name: 'Hydro Flask Standard Mouth 21oz',
              description: 'Double-wall vacuum insulated water bottle',
              brand: 'Hydro Flask',
              category: 'Cooking & Hydration',
              similarity: 0.91,
              price: 34.95,
            },
          ],
        },
      ],
      totalItemsFound: 2,
      analysisConfidence: 0.90,
      processingTimeMs: 2000,
    };

    setAnalysisResult(mockResult);
    setIsAnalyzing(false);
    return mockResult;
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysisResult(null);
  }, []);

  return {
    isAnalyzing,
    analysisResult,
    analyzeImage,
    clearAnalysis,
  };
}