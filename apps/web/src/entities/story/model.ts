export interface Story {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  assignee: string | null;
}

export interface Board {
  name: string;
  description: string;
  userStories: Story[];
}
