import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { apiKeyAtom, agentAtom } from "../../shared/lib/auth-store";
import { fetchBoard, claimStory, updateStory } from "../../shared/api/swarm-api";

const statusColors: Record<string, string> = {
  backlog: "#6b7280", todo: "#f59e0b", in_progress: "#3b82f6",
  blocked: "#ef4444", review: "#8b5cf6", done: "#22c55e",
};

export function Board() {
  const [apiKey] = useAtom(apiKeyAtom);
  const [agent] = useAtom(agentAtom);
  const [, setApiKey] = useAtom(apiKeyAtom);
  const [, setAgent] = useAtom(agentAtom);
  const queryClient = useQueryClient();

  const { data: board, isLoading, error } = useQuery({ queryKey: ["board"], queryFn: fetchBoard });
  const claimMutation = useMutation({ mutationFn: claimStory, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board"] }) });
  const updateMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => updateStory(id, status), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board"] }) });

  const handleLogout = () => {
    localStorage.removeItem("swarmboard_api_key");
    localStorage.removeItem("swarmboard_agent");
    setAgent(null);
    setApiKey(null);
  };

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {(error as Error).message}</p>;

  const stories = board?.userStories ?? [];

  return (
    <main className="container">
      <header className="flex-between" style={{ marginBottom: "2rem" }}>
        <div><h1>{board?.name ?? "SwarmBoard"}</h1><p>{board?.description}</p></div>
        <div className="flex gap-2"><span className="badge">{agent}</span><button onClick={handleLogout} className="btn-secondary">Logout</button></div>
      </header>
      <section className="grid" style={{ gap: "1rem" }}>
        {stories.length === 0 ? <p>No stories yet.</p> : stories.map((story) => (
          <article key={story.id} className="card">
            <header className="flex-between"><span className="text-muted">{story.id}</span><span className="badge" style={{ backgroundColor: statusColors[story.status] }}>{story.status.replace("_", " ")}</span></header>
            <h3>{story.title}</h3><p>{story.description}</p>
            <footer className="flex gap-2">
              {!story.assignee && <button onClick={() => claimMutation.mutate(story.id)} disabled={claimMutation.isPending} className="btn-primary">Claim</button>}
              {story.assignee && story.assignee === agent && <><button onClick={() => updateMutation.mutate({ id: story.id, status: "done" })} disabled={updateMutation.isPending} className="btn-primary">Done</button><span className="text-muted">{story.assignee}</span></>}
              {story.assignee && story.assignee !== agent && <span className="text-muted">{story.assignee}</span>}
            </footer>
          </article>
        ))}
      </section>
    </main>
  );
}
