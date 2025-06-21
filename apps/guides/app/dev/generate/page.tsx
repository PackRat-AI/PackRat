'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/components/ui/use-toast';
import { FileText, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

// This ensures the page only works in development
const _isDevelopment = process.env.NODE_ENV === 'development';

// Types
type ContentCategory =
  | 'gear-essentials'
  | 'pack-strategy'
  | 'weight-management'
  | 'trip-planning'
  | 'seasonal-guides'
  | 'activity-specific'
  | 'destination-guides'
  | 'maintenance'
  | 'emergency-prep'
  | 'family-adventures'
  | 'budget-options'
  | 'sustainability'
  | 'tech-outdoors'
  | 'food-nutrition'
  | 'beginner-resources';

type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';

interface ContentRequest {
  title: string;
  description?: string;
  categories: ContentCategory[];
  difficulty?: DifficultyLevel;
  author?: string;
  generateFullContent?: boolean;
}

// Category display names
const CATEGORY_DISPLAY_NAMES: Record<ContentCategory, string> = {
  'gear-essentials': 'Gear Essentials',
  'pack-strategy': 'Pack Strategy',
  'weight-management': 'Weight Management',
  'trip-planning': 'Trip Planning',
  'seasonal-guides': 'Seasonal Guides',
  'activity-specific': 'Activity-Specific',
  'destination-guides': 'Destination Guides',
  maintenance: 'Maintenance',
  'emergency-prep': 'Emergency Prep',
  'family-adventures': 'Family Adventures',
  'budget-options': 'Budget Options',
  sustainability: 'Sustainability',
  'tech-outdoors': 'Tech Outdoors',
  'food-nutrition': 'Food & Nutrition',
  'beginner-resources': 'Beginner Resources',
};

const difficulties: DifficultyLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'];

export default function GeneratePage() {
  // State for single post generation
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<ContentCategory[]>([]);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('All Levels');
  const [author, setAuthor] = useState('');
  const [generateFull, setGenerateFull] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');

  // State for batch generation
  const [batchCount, setBatchCount] = useState(5);
  const [batchCategories, setBatchCategories] = useState<ContentCategory[]>([]);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<string[]>([]);

  // Handle category toggle for single post
  const handleCategoryToggle = (category: ContentCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  // Handle category toggle for batch generation
  const handleBatchCategoryToggle = (category: ContentCategory) => {
    setBatchCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  // Generate a single post
  const generateSinglePost = async () => {
    if (!title) {
      toast({
        title: 'Title Required',
        description: 'Please enter a title for your post',
        variant: 'destructive',
      });
      return;
    }

    if (selectedCategories.length === 0) {
      toast({
        title: 'Categories Required',
        description: 'Please select at least one category',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    setGeneratedContent('');

    try {
      const response = await fetch('/api/dev/generate-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          categories: selectedCategories,
          difficulty,
          author: author || undefined,
          generateFullContent: generateFull,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate post');
      }

      const data = await response.json();

      if (data.success) {
        setGeneratedContent(data.content);
        toast({
          title: 'Post Generated',
          description: `Successfully created: ${data.filePath}`,
        });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error generating post:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  // Generate batch posts
  const generateBatchPosts = async () => {
    setBatchGenerating(true);
    setGeneratedFiles([]);

    try {
      const response = await fetch('/api/dev/generate-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          count: batchCount,
          categories: batchCategories.length > 0 ? batchCategories : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate posts');
      }

      const data = await response.json();

      if (data.success) {
        setGeneratedFiles(data.filePaths);
        toast({
          title: 'Batch Generation Complete',
          description: `Successfully created ${data.filePaths.length} posts`,
        });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error generating batch:', error);
      toast({
        title: 'Batch Generation Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setBatchGenerating(false);
    }
  };

  // Clear form
  const clearForm = () => {
    setTitle('');
    setDescription('');
    setSelectedCategories([]);
    setDifficulty('All Levels');
    setAuthor('');
    setGeneratedContent('');
  };

  return (
    <div className="container py-10">
      <Toaster />

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Content Generator</h1>
        <p className="text-muted-foreground mt-2">
          Generate MDX blog posts for your outdoor adventure planning app
        </p>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="single">Single Post</TabsTrigger>
          <TabsTrigger value="batch">Batch Generation</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Post Details</CardTitle>
                <CardDescription>Enter the details for your new blog post</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter post title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the post"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Categories (select at least one)</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {Object.entries(CATEGORY_DISPLAY_NAMES).map(([key, name]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${key}`}
                          checked={selectedCategories.includes(key as ContentCategory)}
                          onCheckedChange={() => handleCategoryToggle(key as ContentCategory)}
                        />
                        <Label htmlFor={`category-${key}`} className="text-sm">
                          {name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select
                    value={difficulty}
                    onValueChange={(value) => setDifficulty(value as DifficultyLevel)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      {difficulties.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="author">Author (optional)</Label>
                  <Input
                    id="author"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Leave blank for random author"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="generate-full"
                    checked={generateFull}
                    onCheckedChange={setGenerateFull}
                  />
                  <Label htmlFor="generate-full">Generate full content</Label>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={clearForm}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear
                </Button>
                <Button onClick={generateSinglePost} disabled={generating}>
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Generate Post
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generated Content</CardTitle>
                <CardDescription>Preview of the generated MDX content</CardDescription>
              </CardHeader>
              <CardContent>
                {generating ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                    <p className="text-muted-foreground">Generating content...</p>
                  </div>
                ) : generatedContent ? (
                  <div className="relative">
                    <Textarea
                      value={generatedContent}
                      readOnly
                      className="font-mono text-sm h-[500px] overflow-auto"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Fill out the form and click "Generate Post" to create content
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="batch">
          <Card>
            <CardHeader>
              <CardTitle>Batch Generation</CardTitle>
              <CardDescription>Generate multiple blog posts at once</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="batch-count">Number of Posts: {batchCount}</Label>
                </div>
                <Slider
                  id="batch-count"
                  min={1}
                  max={20}
                  step={1}
                  value={[batchCount]}
                  onValueChange={(value) => setBatchCount(value[0])}
                />
              </div>

              <div className="space-y-2">
                <Label>Focus Categories (optional)</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Select categories to focus on, or leave empty for a mix
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(CATEGORY_DISPLAY_NAMES).map(([key, name]) => (
                    <Badge
                      key={key}
                      variant={
                        batchCategories.includes(key as ContentCategory) ? 'default' : 'outline'
                      }
                      className="cursor-pointer"
                      onClick={() => handleBatchCategoryToggle(key as ContentCategory)}
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="bg-muted p-4 rounded-md">
                <h3 className="font-medium mb-2">Generation Details</h3>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• All posts will have full content generated</li>
                  <li>• Random authors will be assigned</li>
                  <li>• This may take several minutes to complete</li>
                  <li>• Files will be saved to content/posts/</li>
                </ul>
              </div>

              {generatedFiles.length > 0 && (
                <div className="border rounded-md p-4">
                  <h3 className="font-medium mb-2">Generated Files ({generatedFiles.length})</h3>
                  <div className="max-h-40 overflow-y-auto">
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      {generatedFiles.map((file, index) => (
                        <li key={index} className="truncate">
                          • {file.split('/').pop()}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={generateBatchPosts} disabled={batchGenerating} className="w-full">
                {batchGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating {batchCount} Posts...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Generate {batchCount} Posts
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
