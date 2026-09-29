import { useMemo, useState } from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { useAccess, type GrantLevel } from "@/lib/access";
import { Field, FormDialog, NoAccess, SectionHeader } from "@/lib/setup";
import {
  GRANT_LEVELS, moduleLabel, useAdminAction, useAdminRoles, usePermissions,
  type AdminRole, type RolePermission,
} from "@/lib/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Draft { level: GrantLevel; max: string }

export function RolesPanel() {
  const { can } = useAccess();
  const allowed = can("adm.role.manage") || can("adm.user.manage");
  const editable = can("adm.role.manage");
  const roles = useAdminRoles(allowed);
  const perms = usePermissions(allowed);

  const [copyFrom, setCopyFrom] = useState<AdminRole | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [draft, setDraft] = useState<Record<string, Draft>>({});

  const copyRole = useAdminAction("copy_role", "Role copied. You can now edit it.");
  const savePerms = useAdminAction("set_role_permissions", "Role permissions saved.");
  const renameRole = useAdminAction("rename_role", "Role renamed.");
  const deleteRole = useAdminAction("delete_role", "Role removed.");

  const grouped = useMemo(() => {
    const out: Record<string, { key: string; description: string }[]> = {};
    (perms.data ?? []).forEach((p) => {
      (out[p.module] ??= []).push({ key: p.key, description: p.description });
    });
    return out;
  }, [perms.data]);

  const openEdit = (r: AdminRole) => {
    const d: Record<string, Draft> = {};
    r.permissions.forEach((p: RolePermission) => {
      d[p.key] = { level: p.level, max: p.max_amount == null ? "" : String(p.max_amount) };
    });
    setDraft(d);
    setName(r.name);
    setEditing(r);
  };

  if (!allowed) return <NoAccess />;
  const rows = roles.data ?? [];

  return (
    <Card>
      <CardContent className="pt-6">
        <SectionHeader
          title="Roles"
          description="Built-in roles cannot be changed. Copy one to make your own."
        />
        <Table>
          <TableHeader><TableRow>
            <TableHead>Role</TableHead><TableHead>Short code</TableHead><TableHead>Type</TableHead>
            <TableHead className="text-right">Permissions</TableHead><TableHead className="text-right">Staff</TableHead>
            <TableHead className="w-56" />
          </TableRow></TableHeader>
          <TableBody>
            {roles.isLoading && <TableSkeletonRows cols={6} />}
            {!roles.isLoading && rows.length === 0 && <TableStateRow colSpan={6} title="No roles" />}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="tabular text-sm">{r.code}</TableCell>
                <TableCell>{r.is_system ? <Badge variant="info">Built-in</Badge> : <Badge variant="neutral">Custom</Badge>}</TableCell>
                <TableCell className="tabular text-right">{r.permissions.length}</TableCell>
                <TableCell className="tabular text-right">{r.user_count}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {editable && (
                      <Button size="sm" variant="outline" onClick={() => { setCopyFrom(r); setCode(""); setName(`${r.name} (copy)`); }}>
                        <Copy className="mr-1 size-4" />Copy
                      </Button>
                    )}
                    {editable && !r.is_system && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}><Pencil className="mr-1 size-4" />Edit</Button>
                        <Button size="sm" variant="outline" disabled={r.user_count > 0} onClick={() => deleteRole.mutate({ p_role_id: r.id })}>
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <FormDialog
          open={!!copyFrom} onOpenChange={(o) => !o && setCopyFrom(null)}
          title={`Copy ${copyFrom?.name ?? "role"}`} busy={copyRole.isPending}
          onSubmit={() => copyRole.mutate(
            { p_source_role_id: copyFrom!.id, p_code: code, p_name: name },
            { onSuccess: () => setCopyFrom(null) },
          )}
        >
          <Field label="Short code" htmlFor="rc-code" hint="A few letters, for example NIGHT."><Input id="rc-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required /></Field>
          <Field label="Name" htmlFor="rc-name"><Input id="rc-name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <p className="text-sm text-muted-foreground">You can only copy permissions you hold yourself.</p>
        </FormDialog>

        {editing && (
          <FormDialog
            open onOpenChange={(o) => !o && setEditing(null)}
            title={`Edit ${editing.name}`} busy={savePerms.isPending || renameRole.isPending}
            onSubmit={() => {
              if (name.trim() && name.trim() !== editing.name) renameRole.mutate({ p_role_id: editing.id, p_name: name.trim() });
              savePerms.mutate({
                p_role_id: editing.id,
                p_permissions: Object.entries(draft).map(([key, d]) => ({
                  key, level: d.level, max_amount: d.level === "L" && d.max !== "" ? Number(d.max) : null,
                })),
              }, { onSuccess: () => setEditing(null) });
            }}
          >
            <Field label="Name" htmlFor="re-name"><Input id="re-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="space-y-5">
              {Object.entries(grouped).map(([mod, list]) => (
                <div key={mod}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{moduleLabel(mod)}</h3>
                  <div className="space-y-2">
                    {list.map((p) => {
                      const on = !!draft[p.key];
                      return (
                        <div key={p.key} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                          <Checkbox
                            id={`p-${p.key}`} checked={on}
                            onCheckedChange={(v) => setDraft((d) => {
                              const next = { ...d };
                              if (v) next[p.key] = { level: "Y", max: "" }; else delete next[p.key];
                              return next;
                            })}
                          />
                          <label htmlFor={`p-${p.key}`} className="flex-1 text-[15px]">{p.description}</label>
                          {on && (
                            <Select
                              value={draft[p.key]!.level}
                              onValueChange={(v) => setDraft((d) => ({ ...d, [p.key]: { ...d[p.key]!, level: v as GrantLevel } }))}
                            >
                              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                              <SelectContent>{GRANT_LEVELS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                          {on && draft[p.key]!.level === "L" && (
                            <Input
                              className="w-32 tabular" inputMode="decimal" placeholder="Limit ₦"
                              value={draft[p.key]!.max}
                              onChange={(e) => setDraft((d) => ({ ...d, [p.key]: { ...d[p.key]!, max: e.target.value } }))}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Y means full. L means up to the limit you set — no limit means zero. O means their own records only.
            </p>
          </FormDialog>
        )}
      </CardContent>
    </Card>
  );
}
