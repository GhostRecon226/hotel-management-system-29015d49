#!/usr/bin/env bash
# Fails if browser code adds up or subtracts money. Money figures come from the database
# (preview_charge, preview_reservation_fee, checkout_outstanding, kpi_summary, amount_due, credit,
# deposit_due). Formatting an amount for display is fine; arithmetic on amounts is not.
# Usage: npm run check:money
set -uo pipefail
cd "$(dirname "$0")/.."
words='amount|balance|total|revenue|price|tax|fee|rate|credit|debit|money|due|deposit|adr|revpar'
hits=$(
  { grep -rnE "\.reduce\(" src | grep -iE "$words"
    grep -rnE "Number\([^)]*($words)[^)]*\)\s*[-+*/]\s*(Number\(|[0-9a-z_.]+)" -i src
    grep -rnE "Math\.(max|min|abs|round)\([^)]*Number\([^)]*($words)" -i src
  } | grep -v -E "src/components/ui/|src/integrations/supabase/types.ts|routeTree.gen" | sort -u
)
if [ -n "$hits" ]; then
  echo "Money arithmetic found in browser code. Use a figure from the database instead:"
  echo "$hits"
  exit 1
fi
echo "OK: no money arithmetic in browser code."
