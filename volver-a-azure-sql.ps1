# volver-a-azure-sql.ps1 (05-nov-2026): vuelve a usar Azure SQL (apaga Supabase). No borra nada en ninguna base.
# OJO: lo que se haya registrado en Supabase despues del cambio NO esta en Azure SQL (avisale a Claude para pasarlo).
az functionapp config appsettings set -g rg-sistema-rl -n rl-fn-verfrut --settings "USAR_SUPABASE=0" -o none
az functionapp restart -g rg-sistema-rl -n rl-fn-verfrut
"LISTO: el sistema vuelve a usar Azure SQL. En 1 minuto todos hacen Ctrl+F5."
