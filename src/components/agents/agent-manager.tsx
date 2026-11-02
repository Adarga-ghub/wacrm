"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  Copy,
  Crown,
  Globe2,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { countryNameFromIso, listPhoneCountries } from "@/lib/whatsapp/phone-country";
import {
  fetchAiTestPhones,
  invalidateAiAgentCaches,
  type AiAgentSummary,
  type AiTestPhone,
} from "./use-ai-agents";

// ------------------------------------------------------------
// Small shared bits
// ------------------------------------------------------------

export function Flag({ iso, className }: { iso: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={cn("text-[9px] font-semibold text-muted-foreground", className)}>
        {iso}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`}
      alt=""
      width={16}
      height={12}
      onError={() => setFailed(true)}
      className={cn(
        "h-3 w-4 shrink-0 rounded-[2px] object-cover shadow-[0_0_0_0.5px_rgba(0,0,0,0.25)]",
        className,
      )}
    />
  );
}

function CountryChip({ iso, onRemove }: { iso: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-foreground">
      <Flag iso={iso} />
      {countryNameFromIso(iso)}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Quitar ${countryNameFromIso(iso)}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/** Single-country picker over every country the CRM can detect. */
function CountrySelect({
  value,
  onChange,
  placeholder,
  exclude,
  disabled,
  className,
}: {
  value: string | null;
  onChange: (iso: string) => void;
  placeholder: string;
  exclude?: string[];
  disabled?: boolean;
  className?: string;
}) {
  const countries = useMemo(() => listPhoneCountries("es"), []);
  const options = exclude?.length
    ? countries.filter((c) => !exclude.includes(c.iso))
    : countries;
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (typeof v === "string" && v) onChange(v);
      }}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-full sm:w-64", className)}>
        <SelectValue>
          {(v: string | null) =>
            v ? (
              <span className="flex items-center gap-1.5">
                <Flag iso={v} />
                {countryNameFromIso(v)}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((c) => (
          <SelectItem key={c.iso} value={c.iso}>
            <span className="flex items-center gap-1.5">
              <Flag iso={c.iso} />
              {c.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Boxed "[flag] Country" tile for a country assigned to an agent. */
export function CountryTile({ iso }: { iso: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-medium text-foreground"
      title={`Atiende a clientes de ${countryNameFromIso(iso)}`}
    >
      <Flag iso={iso} className="h-4 w-6 rounded-[3px]" />
      {countryNameFromIso(iso)}
    </span>
  );
}

// ------------------------------------------------------------
// Agent list (cards) + duplicate / rename / delete
// ------------------------------------------------------------

export function AgentList({
  agents,
  selectedId,
  onSelect,
  canEdit,
  onDuplicated,
  onChanged,
  onDeleted,
}: {
  agents: AiAgentSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  canEdit: boolean;
  /** Called with the new agent's id after a successful duplicate. */
  onDuplicated: (id: string) => void;
  /** Called after a rename (refresh the list). */
  onChanged: () => void;
  /** Called with the removed agent's id after a delete. */
  onDeleted: (id: string) => void;
}) {
  const [source, setSource] = useState<AiAgentSummary | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<AiAgentSummary | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<AiAgentSummary | null>(null);

  const rename = async () => {
    if (!renaming) return;
    const value = newName.trim();
    if (!value) {
      toast.error("El nombre no puede estar vacío.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/ai/agents/${renaming.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo cambiar el nombre.");
        return;
      }
      invalidateAiAgentCaches();
      toast.success("Nombre actualizado.");
      setRenaming(null);
      onChanged();
    } catch {
      toast.error("No se pudo cambiar el nombre.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ai/config?agentId=${encodeURIComponent(deleting.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo eliminar el agente.");
        return;
      }
      invalidateAiAgentCaches();
      toast.success(`Agente "${deleting.name}" eliminado.`);
      const id = deleting.id;
      setDeleting(null);
      onDeleted(id);
    } catch {
      toast.error("No se pudo eliminar el agente.");
    } finally {
      setBusy(false);
    }
  };

  const openDuplicate = (a: AiAgentSummary) => {
    setSource(a);
    setName("");
  };

  const duplicate = async () => {
    if (!source) return;
    if (!name.trim()) {
      toast.error("Ponle un nombre al nuevo agente.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/ai/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: source.id, name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo duplicar el agente.");
        return;
      }
      invalidateAiAgentCaches();
      toast.success(`Agente "${name.trim()}" creado. Escríbele su prompt y asígnale países.`);
      setSource(null);
      onDuplicated(data.id);
    } catch {
      toast.error("No se pudo duplicar el agente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => {
          const live = a.is_active && a.auto_reply_enabled;
          const selected = a.id === selectedId;
          return (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(a.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(a.id);
                }
              }}
              className={cn(
                "group flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-primary/50",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    selected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                  )}
                >
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-semibold text-foreground">{a.name}</p>
                    {a.is_default && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        <Crown className="h-3 w-3" /> Principal
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        live ? "bg-emerald-500" : "bg-muted-foreground/40",
                      )}
                    />
                    {live ? "Respondiendo" : "Apagado"} · {a.model}
                  </p>
                </div>
              </div>

              <div className="flex min-h-6 flex-wrap items-center gap-1.5">
                {a.is_default ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Globe2 className="h-3.5 w-3.5" /> Todos los países sin agente propio
                  </span>
                ) : a.countries.length > 0 ? (
                  a.countries.map((iso) => <CountryTile key={iso} iso={iso} />)
                ) : (
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    Sin países asignados — no recibe chats todavía
                  </span>
                )}
              </div>

              {canEdit && (
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenaming(a);
                      setNewName(a.name);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar nombre
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDuplicate(a);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicar
                  </Button>
                  {/* The default agent is the fallback for every country
                      without an agent, so it can't be deleted from here. */}
                  {!a.is_default && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleting(a);
                      }}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!source} onOpenChange={(open) => !open && setSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicar “{source?.name}”</DialogTitle>
            <DialogDescription>
              La copia tendrá la misma conexión (proveedor, modelo y API key) y la misma
              configuración, pero sin prompt ni documentos. El agente original no se modifica.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dup-name">Nombre del nuevo agente</Label>
            <Input
              id="dup-name"
              value={name}
              autoFocus
              maxLength={80}
              placeholder="Ej.: Agente Dominicano"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void duplicate();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSource(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={duplicate} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Duplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar nombre del agente</DialogTitle>
            <DialogDescription>
              Solo cambia el nombre; su prompt, países y configuración quedan igual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-agent">Nombre</Label>
            <Input
              id="rename-agent"
              value={newName}
              autoFocus
              maxLength={80}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void rename();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={rename} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar el agente “{deleting?.name}”?</DialogTitle>
            <DialogDescription>
              Esta eliminación es definitiva y no se puede deshacer. Se borrarán su prompt,
              su configuración y sus documentos. Los chats que atendía pasarán al agente de su
              país o, si no hay, al agente principal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ------------------------------------------------------------
// Identity: name + countries of one agent
// ------------------------------------------------------------

export function AgentIdentityCard({
  agent,
  allAgents,
  canEdit,
  onSaved,
}: {
  agent: AiAgentSummary;
  allAgents: AiAgentSummary[];
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState(agent.name);
  const [countries, setCountries] = useState<string[]>(agent.countries ?? []);
  // The parent remounts this card (key) when the agent or its saved
  // values change, so the local draft always starts from the server.
  const [saving, setSaving] = useState(false);

  // Countries already claimed by another agent (routing picks the first,
  // so overlapping would make one of them never answer).
  const takenBy = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of allAgents) {
      if (a.id === agent.id || a.is_default) continue;
      for (const c of a.countries ?? []) m.set(c, a.name);
    }
    return m;
  }, [allAgents, agent.id]);

  const dirty =
    name.trim() !== agent.name ||
    countries.join(",") !== (agent.countries ?? []).join(",");

  const save = async () => {
    if (!name.trim()) {
      toast.error("El nombre no puede estar vacío.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/ai/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          agent.is_default ? { name: name.trim() } : { name: name.trim(), countries },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar.");
        return;
      }
      invalidateAiAgentCaches();
      toast.success("Agente actualizado.");
      onSaved();
    } catch {
      toast.error("No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const addCountry = (iso: string) => {
    const owner = takenBy.get(iso);
    if (owner) {
      toast.error(`${countryNameFromIso(iso)} ya está asignado a "${owner}".`);
      return;
    }
    setCountries((cs) => (cs.includes(iso) ? cs : [...cs, iso]));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4 text-primary" /> Identidad del agente
        </CardTitle>
        <CardDescription>
          {agent.is_default
            ? "Agente principal: responde a todos los países que no tengan un agente propio."
            : "Este agente responde solo a los clientes de los países que marques aquí. Cuando empieza a hablar con un cliente, ese chat queda con él y ningún otro agente se mete."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="agent-name">Nombre</Label>
          <Input
            id="agent-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit || saving}
            className="sm:max-w-sm"
          />
        </div>

        {!agent.is_default && (
          <div className="space-y-2">
            <Label>Países que atiende</Label>
            <div className="flex flex-wrap gap-1.5">
              {countries.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Ningún país todavía — agrega al menos uno para que reciba chats.
                </span>
              ) : (
                countries.map((iso) => (
                  <CountryChip
                    key={iso}
                    iso={iso}
                    onRemove={
                      canEdit
                        ? () => setCountries((cs) => cs.filter((c) => c !== iso))
                        : undefined
                    }
                  />
                ))
              )}
            </div>
            {canEdit && (
              <CountrySelect
                value={null}
                onChange={addCountry}
                placeholder="Agregar país…"
                exclude={countries}
                disabled={saving}
              />
            )}
          </div>
        )}

        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar identidad
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Test numbers with a simulated country
// ------------------------------------------------------------

export function TestPhonesCard({
  canEdit,
  agents,
}: {
  canEdit: boolean;
  agents: AiAgentSummary[];
}) {
  const [phones, setPhones] = useState<AiTestPhone[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPhone, setNewPhone] = useState("");
  const [newCountry, setNewCountry] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setPhones(await fetchAiTestPhones(true));
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    void fetchAiTestPhones(true).then((list) => {
      if (cancelled) return;
      setPhones(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (phone: string, country: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/ai/test-phones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, country_iso: country }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar el número de prueba.");
        return false;
      }
      invalidateAiAgentCaches();
      await load();
      toast.success(`Ahora ese número se identifica como ${countryNameFromIso(country)}.`);
      return true;
    } catch {
      toast.error("No se pudo guardar el número de prueba.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/ai/test-phones?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "No se pudo quitar el número.");
        return;
      }
      invalidateAiAgentCaches();
      await load();
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (newPhone.replace(/\D/g, "").length < 7) {
      toast.error("Escribe el número de prueba.");
      return;
    }
    if (!newCountry) {
      toast.error("Elige el país que quieres simular.");
      return;
    }
    if (await save(newPhone, newCountry)) {
      setNewPhone("");
      setNewCountry(null);
    }
  };

  // Which agent a simulated country lands on (mirrors server routing).
  const agentFor = (iso: string) =>
    agents.find(
      (a) => !a.is_default && a.is_active && a.auto_reply_enabled && a.countries.includes(iso),
    ) ?? agents.find((a) => a.is_default);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Phone className="h-4 w-4 text-primary" /> Números de prueba
        </CardTitle>
        <CardDescription>
          Cuando escribas al CRM desde uno de estos números, se identificará con el país que
          elijas aquí y te responderá el agente de ese país. Cambia el país cuando quieras
          para probar otro agente (los números de prueba nunca quedan amarrados a un agente).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : phones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay números de prueba.</p>
        ) : (
          <ul className="space-y-2">
            {phones.map((p) => {
              const target = agentFor(p.country_iso);
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center"
                >
                  <span className="font-mono text-sm text-foreground sm:w-36">+{p.phone}</span>
                  <CountrySelect
                    value={p.country_iso}
                    onChange={(iso) => void save(p.phone, iso)}
                    placeholder="País"
                    disabled={!canEdit || busy}
                  />
                  <span className="flex-1 text-xs text-muted-foreground">
                    {target ? <>Responde: <b className="text-foreground">{target.name}</b></> : null}
                  </span>
                  {canEdit && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => void remove(p.id)}
                      disabled={busy}
                      aria-label="Quitar número de prueba"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canEdit && (
          <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
            <Input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Ej.: 8294759418"
              inputMode="tel"
              className="sm:w-48"
              disabled={busy}
            />
            <CountrySelect
              value={newCountry}
              onChange={setNewCountry}
              placeholder="País a simular…"
              disabled={busy}
            />
            <Button onClick={add} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Agregar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
