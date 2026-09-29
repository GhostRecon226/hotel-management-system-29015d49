import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, UserPlus, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAccess } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { Field, FormDialog, NoAccess, SectionHeader } from "@/lib/setup";
import { formatDateTime } from "@/lib/reservations";
import { useAdminAction, useAdminRoles, useAdminUsers, useMyProperties, type AdminUser } from "@/lib/admin";
import { inviteStaffMember } from "@/lib/invite.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function UsersPanel() {
  const { can } = useAccess();
  const allowed = can("adm.user.manage");
  const users = useAdminUsers(allowed);
  const roles = useAdminRoles(allowed);
  const properties = useMyProperties();
  const qc = useQueryClient();
  const [invite, setInvite] = useState(false);
  const [addRoleFor, setAddRoleFor] = useState<AdminUser | null>(null);

  const setStatus = useAdminAction("set_user_status", "Staff member updated.");
  const removeRole = useAdminAction("remove_role", "Role removed.");

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [roleId, setRoleId] = useState("");

  const inviteFn = useServerFn(inviteStaffMember);
  const sendInvite = useMutation({
    mutationFn: () => inviteFn({
      data: {
        email, fullName, phone, propertyId, roleId,
        redirectTo: `${window.location.origin}/auth`,
      },
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      setInvite(false);
      setEmail(""); setFullName(""); setPhone(""); setRoleId("");
      if (res.emailed) toast.success("Invitation sent. They will get an email to set a password.");
      else toast.success(`Account created. Temporary password: ${res.tempPassword}`, { duration: 30_000 });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const [rProperty, setRProperty] = useState("");
  const [rRole, setRRole] = useState("");
  const assignRole = useAdminAction("assign_role", "Role added.");

  if (!allowed) return <NoAccess />;
  const rows = users.data ?? [];

  return (
    <Card>
      <CardContent className="pt-6">
        <SectionHeader
          title="Staff"
          description="People who can sign in to this hotel. Roles are given per property."
          action={<Button onClick={() => { setPropertyId(properties[0]?.id ?? ""); setInvite(true); }}><UserPlus className="mr-2 size-4" />Invite staff</Button>}
        />
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Roles</TableHead>
            <TableHead>Last signed in</TableHead><TableHead>Status</TableHead><TableHead className="w-44" />
          </TableRow></TableHeader>
          <TableBody>
            {users.isLoading && <TableSkeletonRows cols={6} />}
            {!users.isLoading && rows.length === 0 && <TableStateRow colSpan={6} title="No staff yet" />}
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name}{u.is_me && <span className="ml-2 text-sm text-muted-foreground">(you)</span>}</TableCell>
                <TableCell className="text-sm">{u.email ?? "—"}{!u.email_confirmed && u.email && <Badge variant="warning" className="ml-2">Not confirmed</Badge>}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {u.roles.length === 0 && <span className="text-sm text-muted-foreground">None</span>}
                    {u.roles.map((r) => (
                      <span key={r.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
                        {r.role_name} · {r.property_name}
                        <button
                          type="button" aria-label={`Remove ${r.role_name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeRole.mutate({ p_user_id: u.id, p_property_id: r.property_id, p_role_id: r.role_id })}
                        ><X className="size-3.5" /></button>
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="tabular text-sm">{u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "Never"}</TableCell>
                <TableCell>{u.status === "active" ? <Badge variant="success" dot>Active</Badge> : <Badge variant="neutral" dot>Switched off</Badge>}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setAddRoleFor(u); setRProperty(properties[0]?.id ?? ""); setRRole(""); }}>
                      <Plus className="mr-1 size-4" />Role
                    </Button>
                    <Button
                      size="sm" variant="outline" disabled={u.is_me}
                      onClick={() => setStatus.mutate({ p_user_id: u.id, p_status: u.status === "active" ? "disabled" : "active" })}
                    >{u.status === "active" ? "Switch off" : "Switch on"}</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <FormDialog
          open={invite} onOpenChange={setInvite} title="Invite a staff member"
          busy={sendInvite.isPending} onSubmit={() => sendInvite.mutate()}
        >
          <Field label="Email" htmlFor="inv-email" hint="They get an email to set their own password.">
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Full name" htmlFor="inv-name"><Input id="inv-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></Field>
          <Field label="Phone (optional)" htmlFor="inv-phone"><Input id="inv-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Property" htmlFor="inv-prop">
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger id="inv-prop"><SelectValue placeholder="Choose a property" /></SelectTrigger>
              <SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Role" htmlFor="inv-role" hint="You can only give roles whose permissions you hold yourself.">
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger id="inv-role"><SelectValue placeholder="Choose a role" /></SelectTrigger>
              <SelectContent>{(roles.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </FormDialog>

        <FormDialog
          open={!!addRoleFor} onOpenChange={(o) => !o && setAddRoleFor(null)}
          title={`Give a role to ${addRoleFor?.full_name ?? ""}`}
          busy={assignRole.isPending}
          onSubmit={() => assignRole.mutate(
            { p_user_id: addRoleFor!.id, p_property_id: rProperty, p_role_id: rRole },
            { onSuccess: () => setAddRoleFor(null) },
          )}
        >
          <Field label="Property" htmlFor="ar-prop">
            <Select value={rProperty} onValueChange={setRProperty}>
              <SelectTrigger id="ar-prop"><SelectValue placeholder="Choose a property" /></SelectTrigger>
              <SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Role" htmlFor="ar-role">
            <Select value={rRole} onValueChange={setRRole}>
              <SelectTrigger id="ar-role"><SelectValue placeholder="Choose a role" /></SelectTrigger>
              <SelectContent>{(roles.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </FormDialog>
      </CardContent>
    </Card>
  );
}
