#!/usr/bin/env python3
"""python3 /var/www/secof/fix_bugs.py"""

# ── BUG 1: comparacionPendiente usa cf.supervisorId que no existe en la tabla ──
ROUTER = "/var/www/secof/server/routers/inventarioCiclo.ts"
with open(ROUTER, "r") as f:
    r = f.read()

old = "LEFT JOIN users u ON u.id=cf.supervisorId "
new = ""  # quitar ese JOIN inútil, no se usa en el SELECT
if old in r:
    r = r.replace(old, new)
    with open(ROUTER, "w") as f:
        f.write(r)
    print("✅ BUG 1 corregido: supervisorId JOIN eliminado")
else:
    print("ℹ️  BUG 1: patrón no encontrado, revisando...")
    if "supervisorId" in r:
        print("   supervisorId sí existe en el archivo, buscando contexto...")
        for i, line in enumerate(r.split('\n')):
            if 'supervisorId' in line:
                print(f"   Línea {i+1}: {line.strip()}")
    else:
        print("   supervisorId NO está en el router — BUG 1 ya corregido o no aplica")

# ── BUG 2: ConteoFisicoTab usa || en vez de && para check de almacenes ─────────
CTRL = "/var/www/secof/client/src/pages/ControlInventario.tsx"
with open(CTRL, "r") as f:
    c = f.read()

old2 = "if (!almacenId || (almacenes as any[]).length === 0)"
new2 = "if (!almacenId && (almacenes as any[]).length === 0)"
if old2 in c:
    c = c.replace(old2, new2)
    with open(CTRL, "w") as f:
        f.write(c)
    print("✅ BUG 2 corregido: || → && en ConteoFisicoTab")
else:
    print("ℹ️  BUG 2: patrón no encontrado")
    if "almacenId" in c:
        for i, line in enumerate(c.split('\n')):
            if 'almacenId &&' in line or 'almacenId ||' in line:
                print(f"   Línea {i+1}: {line.strip()}")
    else:
        print("   ConteoFisicoTab no encontrado — ¿se subió el nuevo archivo?")

print("\nListo. Corre: cd /var/www/secof && pnpm run build && pm2 restart 1")
