import { useEffect, useState } from "react";
import { useAccess } from "@/lib/access";
import { NoAccess, SectionHeader } from "@/lib/setup";
import { useAdminAction, useAdminRoles, usePermissions } from "@/lib/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function LimitsPanel() {
  const { can } = useAccess();
  const allowed = can("adm.role.manage");
  const roles = useAdminRoles(allowed);
  const perms = usePermissions(allowed);
  const setLimit = useAdminAction("set_approval_limit", "Limit saved.");
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!roles.data) return;
    const v: Record<string, string> = {};
    roles.data.forEach((r) => r.permissions.filter((p) => p.level === "L").forEach((p) => {
      v[`${r.id}|${p.key}`] = p.max_amount == null ? "" : String(p.max_amount);
    }));
    setValues(v);
  }, [roles.data]);

  if (!allowed) return <NoAccess />;

  const describe = (key: string) => perms.data?.find((p) => p.key === key)?.description ?? key;
  const rows = (roles.data ?? []).flatMap((r) => r.permissions.filter((p) => p.level === "L").map((p) => ({ role: r, perm: p })));

  return (
    <Card>
      <CardContent className="pt-6">
        <SectionHeader
          title="Approval limits"
          description="The most a role may approve by itself in this hotel, built-in roles included. A role set to L with no limit can approve nothing. Anything above the limit goes to an approver."
        />
        <Table>
          <TableHeader><TableRow>
            <TableHead>Role</TableHead><TableHead>Action</TableHead><TableHead className="w-56 text-right">Maximum amount (₦)</TableHead><TableHead className="w-28" />
          </TableRow></TableHeader>
          <TableBody>
            {roles.isLoading && <TableSkeletonRows cols={4} />}
            {!roles.isLoading && rows.length === 0 && (
              <TableStateRow colSpan={4} title="No limits to set" description="Limits appear here once a role has a permission set to L." />
            )}
            {rows.map(({ role, perm }) => {
              const k = `${role.id}|${perm.key}`;
              return (
                <TableRow key={k}>
                  <TableCell className="font-medium">
                    {role.name}{role.is_system && <Badge variant="info" className="ml-2">Built-in</Badge>}
                  </TableCell>
                  <TableCell>{describe(perm.key)}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      className="ml-auto w-44 text-right tabular" inputMode="decimal" placeholder="0"
                      value={values[k] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm" variant="outline" disabled={setLimit.isPending}
                      onClick={() => setLimit.mutate({
                        p_role_id: role.id, p_permission_key: perm.key,
                        p_max_amount: values[k] === "" || values[k] == null ? null : values[k],
                      })}
                    >Save</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
