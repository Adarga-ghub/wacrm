'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Sparkles, Settings2, BarChart3, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AiPlayground } from '@/components/agents/ai-playground';
import { AiUsageCard } from '@/components/agents/ai-usage';
import { AiConfig } from '@/components/settings/ai-config';
import {
  AgentIdentityCard,
  AgentList,
  TestPhonesCard,
} from '@/components/agents/agent-manager';
import {
  fetchAiAgents,
  invalidateAiAgentCaches,
  type AiAgentSummary,
} from '@/components/agents/use-ai-agents';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';

type Tab = 'playground' | 'setup' | 'usage';

export default function AgentsPage() {
  const { accountRole } = useAuth();
  const canEdit = accountRole ? canEditSettings(accountRole) : false;
  const [tab, setTab] = useState<Tab>('playground');
  const [agents, setAgents] = useState<AiAgentSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    invalidateAiAgentCaches();
    const list = await fetchAiAgents(true);
    setAgents(list);
    return list;
  }, []);

  // First load: select the default agent. Land first-time users (no
  // agent yet) on Setup, returning users on the Playground.
  useEffect(() => {
    let cancelled = false;
    invalidateAiAgentCaches();
    void fetchAiAgents(true).then((list) => {
      if (cancelled) return;
      setAgents(list);
      setSelectedId(list[0]?.id ?? null);
      setTab(list.length > 0 ? 'playground' : 'setup');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = agents?.find((a) => a.id === selectedId) ?? null;
  // Before the first agent exists, the Setup form creates the default
  // one (no agentId).
  const agentId = selected?.id ?? null;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          AI Agents
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Tus agentes de IA. Cada uno tiene su propio nombre, prompt y países: el
        cliente recibe la respuesta del agente de su país, y si su país no tiene
        agente, responde el agente principal.
      </p>

      {agents === null ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando agentes…
        </div>
      ) : (
        <>
          {agents.length > 0 && (
            <div className="mt-6">
              <AgentList
                agents={agents}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
                canEdit={canEdit}
                onDuplicated={(id) => {
                  void loadAgents().then(() => {
                    setSelectedId(id);
                    setTab('setup');
                  });
                }}
                onChanged={() => void loadAgents()}
                onDeleted={(id) => {
                  void loadAgents().then((list) => {
                    if (selectedId === id) setSelectedId(list[0]?.id ?? null);
                  });
                }}
              />
            </div>
          )}

          <div className="mt-6 rounded-xl border border-border p-4">
            {selected && (
              <p className="mb-3 text-sm text-muted-foreground">
                Agente seleccionado:{' '}
                <span className="font-semibold text-foreground">{selected.name}</span>
              </p>
            )}
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList>
                <TabsTrigger value="playground">
                  <Sparkles className="mr-1.5 h-4 w-4" /> Playground
                </TabsTrigger>
                <TabsTrigger value="setup">
                  <Settings2 className="mr-1.5 h-4 w-4" /> Setup
                </TabsTrigger>
                {canEdit && (
                  <TabsTrigger value="usage">
                    <BarChart3 className="mr-1.5 h-4 w-4" /> Usage
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="playground" className="mt-4">
                {/* key: a fresh transcript per agent */}
                <AiPlayground
                  key={agentId ?? 'default'}
                  agentId={agentId}
                  onGoToSetup={() => setTab('setup')}
                />
              </TabsContent>

              <TabsContent value="setup" className="mt-4 space-y-6">
                {selected && (
                  <AgentIdentityCard
                    key={`${selected.id}:${selected.name}:${selected.countries.join(',')}`}
                    agent={selected}
                    allAgents={agents}
                    canEdit={canEdit}
                    onSaved={() => void loadAgents()}
                  />
                )}
                <AiConfig
                  key={agentId ?? 'default'}
                  agentId={agentId}
                  isDefaultAgent={selected ? selected.is_default : true}
                  onSaved={() => {
                    void loadAgents().then((list) => {
                      if (!selectedId) setSelectedId(list[0]?.id ?? null);
                    });
                  }}
                  onRemoved={() => {
                    void loadAgents().then((list) => {
                      setSelectedId(list[0]?.id ?? null);
                    });
                  }}
                />
              </TabsContent>

              {canEdit && (
                <TabsContent value="usage" className="mt-4">
                  <AiUsageCard />
                </TabsContent>
              )}
            </Tabs>
          </div>

          {agents.length > 0 && (
            <div className="mt-6">
              <TestPhonesCard canEdit={canEdit} agents={agents} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
