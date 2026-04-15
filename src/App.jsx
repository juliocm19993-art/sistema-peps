import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  ArrowUpDown,
  Boxes,
  Cloud,
  Database,
  Package,
  Pencil,
  Plus,
  Save,
  ShoppingCart,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { motion } from "framer-motion";

const initialProducts = [
  { id: 1, name: "RT30", quantity: 20, costTotal: 1731.6, wholesale: 900, retail: 1500 },
  { id: 2, name: "RT60", quantity: 10, costTotal: 1357.2, wholesale: 1650, retail: 2750 },
  { id: 3, name: "CJC-1295 5mg + IPA - 5mg", quantity: 20, costTotal: 962.0, wholesale: 300, retail: 650 },
  { id: 4, name: "Cagrilintide - 5MG", quantity: 10, costTotal: 530.4, wholesale: 600, retail: 950 },
  { id: 5, name: "GHK-CU 50 MG", quantity: 20, costTotal: 317.2, wholesale: 300, retail: 500 },
  { id: 6, name: "GHK-CU 100 MG", quantity: 20, costTotal: 374.4, wholesale: 400, retail: 750 },
  { id: 7, name: "HGH Fragment 176-191 - 10MG", quantity: 10, costTotal: 863.2, wholesale: 450, retail: 850 },
  { id: 8, name: "MOTS-C - 10MG", quantity: 20, costTotal: 598.0, wholesale: 300, retail: 550 },
  { id: 9, name: "NAD+ - 1000MG", quantity: 10, costTotal: 681.2, wholesale: 450, retail: 850 },
  { id: 10, name: "SLU-PP-322 - 5 MG", quantity: 10, costTotal: 494.0, wholesale: 350, retail: 550 },
];

const initialSales = [
  { id: 1, date: "2026-04-10", productId: 1, type: "varejo", qty: 2 },
  { id: 2, date: "2026-04-11", productId: 2, type: "atacado", qty: 1 },
  { id: 3, date: "2026-04-12", productId: 8, type: "varejo", qty: 3 },
  { id: 4, date: "2026-04-13", productId: 5, type: "atacado", qty: 4 },
  { id: 5, date: "2026-04-14", productId: 3, type: "varejo", qty: 2 },
];

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const SUPABASE_SQL = `create table if not exists products (
  id bigint primary key,
  name text not null,
  quantity integer not null default 0,
  cost_total numeric not null default 0,
  wholesale numeric not null default 0,
  retail numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists sales (
  id bigint primary key,
  date date not null,
  product_id bigint not null references products(id) on delete cascade,
  type text not null check (type in ('atacado', 'varejo')),
  qty integer not null default 0,
  created_at timestamptz default now()
);`;

function brl(value) {
  return currency.format(Number(value || 0));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseBRNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;

  const raw = String(value).trim();
  if (!raw) return 0;

  const cleaned = raw
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyInput(value) {
  return brl(parseBRNumber(value));
}

function parseBulkProducts(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      // modo ; ou TAB
      if (/[;\t]/.test(line)) {
        const cols = line.split(/[;\t]+/).map((p) => p.trim()).filter(Boolean);

        if (cols.length < 5) {
          throw new Error("Cada linha precisa ter pelo menos 5 colunas.");
        }

        const [name, quantity, costTotal, maybeCostUnit, maybeWholesale, maybeRetail] = cols;
        const hasSixCols = cols.length >= 6;

        return {
          id: Date.now() + index,
          name,
          quantity: parseBRNumber(quantity),
          costTotal: parseBRNumber(costTotal),
          wholesale: parseBRNumber(hasSixCols ? maybeWholesale : maybeCostUnit),
          retail: parseBRNumber(hasSixCols ? maybeRetail : maybeWholesale),
        };
      }

      // modo espaço inteligente
      const parts = line.split(/\s+/);

      if (parts.length < 5) {
        throw new Error("Formato inválido.");
      }

      const retail = parts.pop();
      const wholesale = parts.pop();
      const costTotal = parts.pop();
      const quantity = parts.pop();
      const name = parts.join(" ");

      return {
        id: Date.now() + index,
        name,
        quantity: parseBRNumber(quantity),
        costTotal: parseBRNumber(costTotal),
        wholesale: parseBRNumber(wholesale),
        retail: parseBRNumber(retail),
      };
    });
}

function getSupabaseConfig() {
  const env =
    typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

  return {
    url: env.VITE_SUPABASE_URL || "",
    anonKey: env.VITE_SUPABASE_ANON_KEY || "",
  };
}

function createSupabaseClientSafe() {
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    return { client: null, configured: false };
  }

  try {
    return { client: createClient(url, anonKey), configured: true };
  } catch {
    return { client: null, configured: false };
  }
}

function mapProductFromDb(row) {
  return {
    id: Number(row.id),
    name: row.name,
    quantity: Number(row.quantity),
    costTotal: Number(row.cost_total),
    wholesale: Number(row.wholesale),
    retail: Number(row.retail),
  };
}

function mapProductToDb(product) {
  return {
    id: Number(product.id),
    name: product.name,
    quantity: Number(product.quantity),
    cost_total: Number(product.costTotal),
    wholesale: Number(product.wholesale),
    retail: Number(product.retail),
  };
}

function mapSaleFromDb(row) {
  return {
    id: Number(row.id),
    date: row.date,
    productId: Number(row.product_id),
    type: row.type,
    qty: Number(row.qty),
  };
}

function mapSaleToDb(sale) {
  return {
    id: Number(sale.id),
    date: sale.date,
    product_id: Number(sale.productId),
    type: sale.type,
    qty: Number(sale.qty),
  };
}

function computeProductMetrics(product, sales) {
  const soldQty = sales
    .filter((sale) => sale.productId === product.id)
    .reduce((sum, sale) => sum + sale.qty, 0);

  const stockCurrent = Math.max(Number(product.quantity || 0) - soldQty, 0);
  const hasStock = Number(product.quantity || 0) > 0;

  const costUnit = hasStock ? Number(product.costTotal || 0) / Number(product.quantity || 0) : 0;

  const marginWholesale =
    hasStock && Number(product.wholesale || 0) > 0
      ? ((Number(product.wholesale || 0) - costUnit) / Number(product.wholesale || 0)) * 100
      : 0;

  const marginRetail =
    hasStock && Number(product.retail || 0) > 0
      ? ((Number(product.retail || 0) - costUnit) / Number(product.retail || 0)) * 100
      : 0;

  return {
    ...product,
    costUnit,
    marginWholesale,
    marginRetail,
    soldQty,
    stockCurrent,
    hasStock,
  };
}

function computeSaleMetrics(sale, products) {
  const product = products.find((item) => item.id === sale.productId);
  const unitPrice = sale.type === "atacado" ? product?.wholesale || 0 : product?.retail || 0;
  const revenue = unitPrice * sale.qty;
  const cost = (product?.costUnit || 0) * sale.qty;
  const profit = revenue - cost;

  return {
    ...sale,
    product,
    unitPrice,
    revenue,
    cost,
    profit,
  };
}

function runSelfTests() {
  const sampleProduct = { id: 999, name: "Teste", quantity: 10, costTotal: 500, wholesale: 80, retail: 120 };
  const sampleSales = [{ id: 1, productId: 999, type: "varejo", qty: 3, date: "2026-01-01" }];
  const enrichedProduct = computeProductMetrics(sampleProduct, sampleSales);
  const enrichedSale = computeSaleMetrics(sampleSales[0], [enrichedProduct]);
  const noEnvConfig = getSupabaseConfig();
  const safeClient = createSupabaseClientSafe();

  return [
    { name: "custo unitário", passed: enrichedProduct.costUnit === 50, expected: "50", received: String(enrichedProduct.costUnit) },
    { name: "estoque atual", passed: enrichedProduct.stockCurrent === 7, expected: "7", received: String(enrichedProduct.stockCurrent) },
    { name: "receita da venda", passed: enrichedSale.revenue === 360, expected: "360", received: String(enrichedSale.revenue) },
    { name: "lucro da venda", passed: enrichedSale.profit === 210, expected: "210", received: String(enrichedSale.profit) },
    {
      name: "ajuste manual de estoque",
      passed: computeProductMetrics({ ...sampleProduct, quantity: 15 }, sampleSales).stockCurrent === 12,
      expected: "12",
      received: String(computeProductMetrics({ ...sampleProduct, quantity: 15 }, sampleSales).stockCurrent),
    },
    {
      name: "configuração sem env não quebra",
      passed: typeof noEnvConfig.url === "string" && typeof noEnvConfig.anonKey === "string",
      expected: "strings vazias ou válidas",
      received: `${typeof noEnvConfig.url}/${typeof noEnvConfig.anonKey}`,
    },
    {
      name: "client seguro sem config",
      passed: safeClient && typeof safeClient.configured === "boolean",
      expected: "objeto seguro",
      received: typeof safeClient,
    },
  ];
}

function KPI({ title, value, icon: Icon, subtitle }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/60">{title}</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</h3>
            <p className="mt-1 text-xs text-white/50">{subtitle}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SectionTitle({ icon: Icon, title, description }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-sm text-white/60">{description}</p>
        </div>
      </div>
    </div>
  );
}

function RowInput({ value, onChange, type = "text", className = "" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      className={`h-9 min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none ${className}`}
    />
  );
}

function MobileField({ label, children, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-white/45">{label}</p>
      <div className="mt-1 break-words text-sm text-white">{children || value}</div>
    </div>
  );
}

function SimpleSelect({ value, onChange, options, className = "" }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-10 rounded-xl border border-white/10 bg-slate-900 px-3 text-white outline-none ${className}`}
    >
      {options.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

export default function SistemaControleNegocio() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [productForm, setProductForm] = useState({ bulkText: "" });
  const [editingAllProducts, setEditingAllProducts] = useState(false);
  const [productDrafts, setProductDrafts] = useState([]);
  const [saleForm, setSaleForm] = useState({ date: todayISO(), productId: "", type: "varejo", qty: "" });
  const [editingProductId, setEditingProductId] = useState(null);
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [productEditForm, setProductEditForm] = useState({});
  const [saleEditForm, setSaleEditForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dbError, setDbError] = useState("");
  const [lastSync, setLastSync] = useState("");
  const [supabaseState] = useState(() => createSupabaseClientSafe());

  const supabase = supabaseState.client;
  const isSupabaseConfigured = supabaseState.configured;
  const testResults = useMemo(() => runSelfTests(), []);

  useEffect(() => {
    let active = true;

    async function loadFromDb() {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setDbError("");

      const [{ data: productsData, error: productsError }, { data: salesData, error: salesError }] = await Promise.all([
        supabase.from("products").select("*").order("name"),
        supabase.from("sales").select("*").order("date", { ascending: false }),
      ]);

      if (!active) return;

      if (productsError || salesError) {
        setDbError(productsError?.message || salesError?.message || "Erro ao carregar banco online.");
        setLoading(false);
        return;
      }

setProducts((productsData || []).map(mapProductFromDb));
setSales((salesData || []).map(mapSaleFromDb));

      setLastSync(new Date().toLocaleString("pt-BR"));
      setLoading(false);
    }

    loadFromDb();
    return () => {
      active = false;
    };
  }, [isSupabaseConfigured, supabase]);


  const enrichedProducts = useMemo(() => products.map((product) => computeProductMetrics(product, sales)), [products, sales]);

  useEffect(() => {
    setProductDrafts(
      products.map((product) => ({
        id: product.id,
        name: product.name,
        quantity: String(Number(product.quantity || 0)),
        costTotal: formatMoneyInput(product.costTotal),
        wholesale: formatMoneyInput(product.wholesale),
        retail: formatMoneyInput(product.retail),
      }))
    );
  }, [products]);
  const enrichedSales = useMemo(() => sales.map((sale) => computeSaleMetrics(sale, enrichedProducts)), [sales, enrichedProducts]);

  const totals = useMemo(() => {
    const inventoryCost = enrichedProducts.reduce(
      (sum, product) => sum + (Number(product.quantity || 0) > 0 ? Number(product.costTotal || 0) : 0),
      0
    );
    const potentialWholesale = enrichedProducts.reduce((sum, product) => sum + product.quantity * product.wholesale, 0);
    const potentialRetail = enrichedProducts.reduce((sum, product) => sum + product.quantity * product.retail, 0);
    const revenue = enrichedSales.reduce((sum, sale) => sum + sale.revenue, 0);
    const profit = enrichedSales.reduce((sum, sale) => sum + sale.profit, 0);
    const soldUnits = enrichedSales.reduce((sum, sale) => sum + sale.qty, 0);
    const avgTicket = enrichedSales.length ? revenue / enrichedSales.length : 0;
    const lowStock = enrichedProducts.filter((product) => product.stockCurrent <= 5).length;

    return { inventoryCost, potentialWholesale, potentialRetail, revenue, profit, soldUnits, avgTicket, lowStock };
  }, [enrichedProducts, enrichedSales]);

  const revenueByProduct = useMemo(() => {
    return enrichedProducts.map((product) => {
      const salesOfProduct = enrichedSales.filter((sale) => sale.productId === product.id);
      return {
        name: product.name.length > 18 ? `${product.name.slice(0, 18)}…` : product.name,
        revenue: salesOfProduct.reduce((sum, sale) => sum + sale.revenue, 0),
        profit: salesOfProduct.reduce((sum, sale) => sum + sale.profit, 0),
      };
    });
  }, [enrichedProducts, enrichedSales]);

  const salesTypeChart = useMemo(
    () => [
      { name: "Atacado", value: enrichedSales.filter((sale) => sale.type === "atacado").reduce((sum, sale) => sum + sale.revenue, 0) },
      { name: "Varejo", value: enrichedSales.filter((sale) => sale.type === "varejo").reduce((sum, sale) => sum + sale.revenue, 0) },
    ],
    [enrichedSales]
  );

  const timelineData = useMemo(() => {
    const map = enrichedSales.reduce((acc, sale) => {
      const current = acc[sale.date] || { date: sale.date, revenue: 0, profit: 0 };
      current.revenue += sale.revenue;
      current.profit += sale.profit;
      acc[sale.date] = current;
      return acc;
    }, {});

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [enrichedSales]);

  const topProduct = useMemo(() => [...revenueByProduct].sort((a, b) => b.profit - a.profit)[0], [revenueByProduct]);

  async function persistProduct(product) {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from("products").upsert(mapProductToDb(product));
    if (error) throw error;
    setLastSync(new Date().toLocaleString("pt-BR"));
  }

  async function persistSale(sale) {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from("sales").upsert(mapSaleToDb(sale));
    if (error) throw error;
    setLastSync(new Date().toLocaleString("pt-BR"));
  }

  async function removeProductFromDb(productId) {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) throw error;
    setLastSync(new Date().toLocaleString("pt-BR"));
  }

  async function removeSaleFromDb(saleId) {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from("sales").delete().eq("id", saleId);
    if (error) throw error;
    setLastSync(new Date().toLocaleString("pt-BR"));
  }


  function startEditAllProducts() {
    setEditingAllProducts(true);
    setProductDrafts(
      products.map((product) => ({
        id: product.id,
        name: product.name,
        quantity: String(Number(product.quantity || 0)),
        costTotal: formatMoneyInput(product.costTotal),
        wholesale: formatMoneyInput(product.wholesale),
        retail: formatMoneyInput(product.retail),
      }))
    );
  }

  function cancelEditAllProducts() {
    setEditingAllProducts(false);
    setProductDrafts(
      products.map((product) => ({
        id: product.id,
        name: product.name,
        quantity: String(Number(product.quantity || 0)),
        costTotal: formatMoneyInput(product.costTotal),
        wholesale: formatMoneyInput(product.wholesale),
        retail: formatMoneyInput(product.retail),
      }))
    );
  }

  function updateProductDraft(productId, field, value) {
    setProductDrafts((prev) =>
      prev.map((item) => (item.id === productId ? { ...item, [field]: value } : item))
    );
  }

  async function saveAllProducts() {
    try {
      setSyncing(true);
      setDbError("");

      const normalizedProducts = productDrafts.map((item) => ({
        id: Number(item.id),
        name: String(item.name || "").trim(),
        quantity: parseBRNumber(item.quantity),
        costTotal: parseBRNumber(item.costTotal),
        wholesale: parseBRNumber(item.wholesale),
        retail: parseBRNumber(item.retail),
      }));

      for (const product of normalizedProducts) {
        await persistProduct(product);
      }

      setProducts(normalizedProducts);
      setEditingAllProducts(false);
    } catch (error) {
      setDbError(error.message || "Erro ao salvar todos os produtos.");
    } finally {
      setSyncing(false);
    }
  }

  async function addProduct() {
    if (!productForm.bulkText || !String(productForm.bulkText).trim()) return;

    try {
      setSyncing(true);
      setDbError("");

      const rows = parseBulkProducts(productForm.bulkText);

      for (const row of rows) {
        await persistProduct(row);
      }

      setProducts((prev) => [...prev, ...rows]);
      setProductForm({ bulkText: "" });
    } catch (error) {
      setDbError(error.message || "Erro ao inserir produtos em lote.");
    } finally {
      setSyncing(false);
    }
  }

  function startEditProduct(product) {
    setEditingProductId(product.id);
    setProductEditForm({
      name: product.name,
      quantity: String(product.quantity),
      costTotal: String(product.costTotal),
      wholesale: String(product.wholesale),
      retail: String(product.retail),
    });
  }

  async function saveProduct(productId) {
    const updatedProduct = {
      id: productId,
      name: productEditForm.name,
      quantity: toNumber(productEditForm.quantity),
      costTotal: toNumber(productEditForm.costTotal),
      wholesale: toNumber(productEditForm.wholesale),
      retail: toNumber(productEditForm.retail),
    };

    try {
      setSyncing(true);
      setDbError("");
      await persistProduct(updatedProduct);
      setProducts((prev) => prev.map((product) => (product.id === productId ? updatedProduct : product)));
      setEditingProductId(null);
      setProductEditForm({});
    } catch (error) {
      setDbError(error.message || "Erro ao atualizar produto.");
    } finally {
      setSyncing(false);
    }
  }

  function cancelEditProduct() {
    setEditingProductId(null);
    setProductEditForm({});
  }

  async function deleteProduct(productId) {
    try {
      setSyncing(true);
      setDbError("");
      if (isSupabaseConfigured && supabase) {
        await supabase.from("sales").delete().eq("product_id", productId);
        await removeProductFromDb(productId);
      }
      setProducts((prev) => prev.filter((product) => product.id !== productId));
      setSales((prev) => prev.filter((sale) => sale.productId !== productId));
      if (editingProductId === productId) cancelEditProduct();
    } catch (error) {
      setDbError(error.message || "Erro ao excluir produto.");
    } finally {
      setSyncing(false);
    }
  }

  async function addSale() {
    if (!saleForm.productId || !saleForm.qty || !saleForm.date) return;

    const selectedProduct = enrichedProducts.find(
      (product) => product.id === Number(saleForm.productId)
    );
    const requestedQty = Number(saleForm.qty || 0);

    if (!selectedProduct || selectedProduct.stockCurrent <= 0) {
      setDbError("Produto sem estoque.");
      return;
    }

    if (requestedQty > selectedProduct.stockCurrent) {
      setDbError("Quantidade maior que o estoque.");
      return;
    }

    const newSale = {
      id: Date.now(),
      date: saleForm.date,
      productId: Number(saleForm.productId),
      type: saleForm.type,
      qty: requestedQty,
    };

    try {
      setSyncing(true);
      setDbError("");
      await persistSale(newSale);
      setSales((prev) => [newSale, ...prev]);
      setSaleForm({ date: todayISO(), productId: "", type: "varejo", qty: "" });
    } catch (error) {
      setDbError(error.message || "Erro ao salvar venda.");
    } finally {
      setSyncing(false);
    }
  }

  function startEditSale(sale) {
    setEditingSaleId(sale.id);
    setSaleEditForm({ date: sale.date, productId: String(sale.productId), type: sale.type, qty: String(sale.qty) });
  }

  async function saveSale(saleId) {
    const updatedSale = {
      id: saleId,
      date: saleEditForm.date,
      productId: Number(saleEditForm.productId),
      type: saleEditForm.type,
      qty: toNumber(saleEditForm.qty),
    };

    try {
      setSyncing(true);
      setDbError("");
      await persistSale(updatedSale);
      setSales((prev) => prev.map((sale) => (sale.id === saleId ? updatedSale : sale)));
      setEditingSaleId(null);
      setSaleEditForm({});
    } catch (error) {
      setDbError(error.message || "Erro ao atualizar venda.");
    } finally {
      setSyncing(false);
    }
  }

  function cancelEditSale() {
    setEditingSaleId(null);
    setSaleEditForm({});
  }

  async function deleteSale(saleId) {
    try {
      setSyncing(true);
      setDbError("");
      await removeSaleFromDb(saleId);
      setSales((prev) => prev.filter((sale) => sale.id !== saleId));
      if (editingSaleId === saleId) cancelEditSale();
    } catch (error) {
      setDbError(error.message || "Erro ao excluir venda.");
    } finally {
      setSyncing(false);
    }
  }

  const tabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "produtos", label: "Produtos" },
    { key: "vendas", label: "Vendas" },
    { key: "estoque", label: "Estoque" },
    { key: "testes", label: "Testes" },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#1d4ed8,_transparent_28%),radial-gradient(circle_at_top_right,_#7c3aed,_transparent_25%),linear-gradient(135deg,_#020617,_#0f172a_45%,_#111827)] text-white">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-2xl md:p-8">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/5 to-transparent" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/70">
                  <Sparkles className="h-3.5 w-3.5" /> Design moderno • Controle inteligente
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">Sistema de Controle do Negócio</h1>
                <p className="mt-3 max-w-2xl text-sm text-white/65 md:text-base">
                  Agora com banco online via Supabase para salvar produtos e vendas na nuvem.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                      isSupabaseConfigured
                        ? "border-emerald-400/20 bg-emerald-500/15 text-emerald-300"
                        : "border-amber-400/20 bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    {isSupabaseConfigured ? "Banco online ativo" : "Configure Supabase"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/80">
                    <Database className="h-3.5 w-3.5" />
                    {lastSync ? `Última sincronização: ${lastSync}` : "Sem sincronização ainda"}
                  </span>
                </div>
              </div>

              <div className="grid min-w-[280px] grid-cols-2 gap-3">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-white/50">Lucro realizado</p>
                  <p className="mt-2 text-xl font-semibold">{brl(totals.profit)}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-white/50">Receita realizada</p>
                  <p className="mt-2 text-xl font-semibold">{brl(totals.revenue)}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {(loading || syncing || dbError || !isSupabaseConfigured) && (
          <div className="mb-6 space-y-3">
            {loading && (
              <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm text-blue-200">
                Carregando dados do sistema...
              </div>
            )}
            {syncing && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                Sincronizando dados com o banco online...
              </div>
            )}
            {dbError && (
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
                {dbError}
              </div>
            )}
            {!isSupabaseConfigured && (
              <div className="whitespace-pre-wrap rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                Configure no arquivo .env:
                {"\n\n"}VITE_SUPABASE_URL=sua_url
                {"\n"}VITE_SUPABASE_ANON_KEY=sua_chave
                {"\n\n"}Depois rode este SQL no Supabase:
                {"\n\n"}{SUPABASE_SQL}
              </div>
            )}
          </div>
        )}

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KPI title="Custo do estoque" value={brl(totals.inventoryCost)} subtitle="Base cadastrada" icon={Package} />
          <KPI title="Potencial atacado" value={brl(totals.potentialWholesale)} subtitle="Venda total por lote" icon={Boxes} />
          <KPI title="Potencial varejo" value={brl(totals.potentialRetail)} subtitle="Venda total máxima" icon={TrendingUp} />
          <KPI title="Ticket médio" value={brl(totals.avgTicket)} subtitle="Por venda lançada" icon={Wallet} />
          <KPI title="Estoque baixo" value={String(totals.lowStock)} subtitle="Itens com 5 ou menos" icon={AlertTriangle} />
        </div>

        <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/10 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm transition ${
                activeTab === tab.key ? "bg-white text-slate-900" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
                <h3 className="mb-4 text-white text-lg font-semibold">Receita e lucro por produto</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByProduct}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.55)" tick={{ fontSize: 12 }} />
                      <YAxis stroke="rgba(255,255,255,0.55)" tickFormatter={(v) => `R$${v}`} />
                      <Tooltip formatter={(value) => brl(value)} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
                      <Legend />
                      <Bar dataKey="revenue" name="Receita" radius={[8, 8, 0, 0]} fill="rgba(59,130,246,0.9)" />
                      <Bar dataKey="profit" name="Lucro" radius={[8, 8, 0, 0]} fill="rgba(168,85,247,0.95)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
                <h3 className="mb-4 text-white text-lg font-semibold">Mix de vendas</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={salesTypeChart} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={5}>
                        <Cell fill="rgba(59,130,246,0.95)" />
                        <Cell fill="rgba(236,72,153,0.95)" />
                      </Pie>
                      <Tooltip formatter={(value) => brl(value)} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
                <h3 className="mb-4 text-white text-lg font-semibold">Evolução diária</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.55)" />
                      <YAxis stroke="rgba(255,255,255,0.55)" tickFormatter={(v) => `R$${v}`} />
                      <Tooltip formatter={(value) => brl(value)} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" name="Receita" stroke="rgba(59,130,246,0.95)" strokeWidth={3} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="profit" name="Lucro" stroke="rgba(168,85,247,0.95)" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
                <h3 className="mb-4 text-white text-lg font-semibold">Resumo executivo</h3>
                <div className="space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-white/60">Produto mais lucrativo</p>
                    <p className="mt-2 text-lg font-semibold">{topProduct?.name || "—"}</p>
                    <p className="text-sm text-white/60">{brl(topProduct?.profit || 0)} em lucro</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 flex items-center justify-between text-sm text-white/60">
                      <span>Unidades vendidas</span>
                      <span>{totals.soldUnits}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                        style={{
                          width: `${Math.min(
                            (totals.soldUnits / Math.max(1, products.reduce((sum, product) => sum + product.quantity, 0))) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-white/60">Margem média estimada varejo</p>
                    <p className="mt-2 text-lg font-semibold">
                      {(enrichedProducts.reduce((sum, product) => sum + product.marginRetail, 0) / Math.max(enrichedProducts.length, 1)).toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-white/60">Margem média estimada atacado</p>
                    <p className="mt-2 text-lg font-semibold">
                      {(enrichedProducts.reduce((sum, product) => sum + product.marginWholesale, 0) / Math.max(enrichedProducts.length, 1)).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "produtos" && (
          <div className="space-y-6">
            <SectionTitle icon={Boxes} title="Cadastro de produtos" description="A lista fica primeiro e o formulário de novo produto vem abaixo para facilitar a edição." />

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-white text-lg font-semibold">Tabela de produtos</h3>
                <div className="flex gap-2">
                  {editingAllProducts ? (
                    <>
                      <button
                        onClick={saveAllProducts}
                        disabled={syncing}
                        className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                      >
                        Salvar todos
                      </button>
                      <button
                        onClick={cancelEditAllProducts}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={startEditAllProducts}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white/90"
                    >
                      Editar todos
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4 lg:hidden">
                {enrichedProducts.map((product) => {
                  const draft = productDrafts.find((item) => item.id === product.id);
                  return (
                    <div key={product.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-base font-semibold text-white">
                            {editingAllProducts ? (
                              <RowInput
                                value={draft?.name || ""}
                                onChange={(e) => updateProductDraft(product.id, "name", e.target.value)}
                              />
                            ) : (
                              product.name
                            )}
                          </p>
                        </div>
                        {product.hasStock ? (
                          <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
                            {product.marginRetail.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full border border-amber-400/20 bg-amber-500/15 px-3 py-1 text-xs text-amber-300">
                            Sem estoque
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <MobileField label="Unidades">
                          {editingAllProducts ? (
                            <RowInput
                              type="text"
                              value={draft?.quantity || ""}
                              onChange={(e) => updateProductDraft(product.id, "quantity", e.target.value)}
                            />
                          ) : (
                            product.quantity
                          )}
                        </MobileField>
                        <MobileField label="Custo unitário" value={brl(product.costUnit)} />
                        <MobileField label="Custo total">
                          {editingAllProducts ? (
                            <RowInput
                              type="text"
                              value={draft?.costTotal || ""}
                              onChange={(e) => updateProductDraft(product.id, "costTotal", e.target.value)}
                            />
                          ) : (
                            brl(product.costTotal)
                          )}
                        </MobileField>
                        <MobileField label="Atacado">
                          {editingAllProducts ? (
                            <RowInput
                              type="text"
                              value={draft?.wholesale || ""}
                              onChange={(e) => updateProductDraft(product.id, "wholesale", e.target.value)}
                            />
                          ) : (
                            brl(product.wholesale)
                          )}
                        </MobileField>
                        <MobileField label="Varejo">
                          {editingAllProducts ? (
                            <RowInput
                              type="text"
                              value={draft?.retail || ""}
                              onChange={(e) => updateProductDraft(product.id, "retail", e.target.value)}
                            />
                          ) : (
                            brl(product.retail)
                          )}
                        </MobileField>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-2">
                        <button className="rounded-xl border border-white/10 bg-white/5 p-2 text-red-300" onClick={() => deleteProduct(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-white/70">
                      <th className="p-3">Produto</th>
                      <th className="p-3">Unidades</th>
                      <th className="p-3">Custo total</th>
                      <th className="p-3">Custo unit.</th>
                      <th className="p-3">Atacado</th>
                      <th className="p-3">Varejo</th>
                      <th className="p-3">Margem</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedProducts.map((product) => {
                      const draft = productDrafts.find((item) => item.id === product.id);
                      return (
                        <tr key={product.id} className="border-b border-white/10 align-middle">
                          <td className="p-3 text-white">
                            {editingAllProducts ? (
                              <RowInput
                                value={draft?.name || ""}
                                onChange={(e) => updateProductDraft(product.id, "name", e.target.value)}
                              />
                            ) : (
                              product.name
                            )}
                          </td>
                          <td className="p-3 text-white/80">
                            {editingAllProducts ? (
                              <RowInput
                                type="text"
                                value={draft?.quantity || ""}
                                onChange={(e) => updateProductDraft(product.id, "quantity", e.target.value)}
                                className="w-20"
                              />
                            ) : (
                              product.quantity
                            )}
                          </td>
                          <td className="p-3 text-white/80">
                            {editingAllProducts ? (
                              <RowInput
                                type="text"
                                value={draft?.costTotal || ""}
                                onChange={(e) => updateProductDraft(product.id, "costTotal", e.target.value)}
                                className="w-28"
                              />
                            ) : (
                              brl(product.costTotal)
                            )}
                          </td>
                          <td className="p-3 text-white/80">{brl(product.costUnit)}</td>
                          <td className="p-3 text-white/80">
                            {editingAllProducts ? (
                              <RowInput
                                type="text"
                                value={draft?.wholesale || ""}
                                onChange={(e) => updateProductDraft(product.id, "wholesale", e.target.value)}
                                className="w-24"
                              />
                            ) : (
                              brl(product.wholesale)
                            )}
                          </td>
                          <td className="p-3 text-white/80">
                            {editingAllProducts ? (
                              <RowInput
                                type="text"
                                value={draft?.retail || ""}
                                onChange={(e) => updateProductDraft(product.id, "retail", e.target.value)}
                                className="w-24"
                              />
                            ) : (
                              brl(product.retail)
                            )}
                          </td>
                          <td className="p-3">
                            {product.hasStock ? (
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
                                {product.marginRetail.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="rounded-full border border-amber-400/20 bg-amber-500/15 px-3 py-1 text-xs text-amber-300">
                                Sem estoque
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex justify-end gap-2">
                              <button className="rounded-xl border border-white/10 bg-white/5 p-2 text-red-300" onClick={() => deleteProduct(product.id)}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-white text-base font-semibold">
                  <Plus className="h-4 w-4" /> Inserção em lote
                </h3>
                <span className="text-[11px] text-white/45">até 10 produtos</span>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-xs text-white/65">
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-white/40">Formato aceito</div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-white/75">
                    <div>Tirzepatida 60MG 10 600 900 1200</div>
                    <div>Cagrilintide 5MG;0;530,40;600,00;950,00</div>
                  </div>
                  <div className="mt-2 text-[11px] text-white/40">
                    Ordem: nome, unidades, custo total, atacado, varejo
                  </div>
                </div>

                <div>
                  <label className="text-sm text-white/80">Produtos em lote</label>
                  <textarea
                    rows={5}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
                    value={productForm.bulkText}
                    onChange={(e) => setProductForm({ bulkText: e.target.value })}
                    placeholder="Cole aqui uma linha por produto"
                  />
                </div>

                <button
                  onClick={addProduct}
                  disabled={syncing}
                  className="w-full rounded-xl bg-white py-2.5 font-semibold text-sm text-slate-900 transition hover:bg-white/90 disabled:opacity-60"
                >
                  Inserir produtos automaticamente
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "vendas" && (
          <div className="space-y-6">
            <SectionTitle icon={ShoppingCart} title="Controle de vendas" description="Histórico primeiro e nova venda abaixo para facilitar o uso." />

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
              <h3 className="mb-4 text-white text-lg font-semibold">Histórico de vendas</h3>

              <div className="space-y-4 lg:hidden">
                {enrichedSales.map((sale) => {
                  const isEditing = editingSaleId === sale.id;
                  return (
                    <div key={sale.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-base font-semibold text-white">
                            {isEditing ? (
                              <SimpleSelect
                                value={saleEditForm.productId || ""}
                                onChange={(value) => setSaleEditForm((prev) => ({ ...prev, productId: value }))}
                                options={products.map((product) => ({ value: String(product.id), label: product.name }))}
                              />
                            ) : (
                              sale.product?.name
                            )}
                          </p>
                          <p className="mt-1 text-xs text-white/50">
                            {isEditing ? (
                              <RowInput
                                type="date"
                                value={saleEditForm.date || ""}
                                onChange={(e) => setSaleEditForm((prev) => ({ ...prev, date: e.target.value }))}
                              />
                            ) : (
                              sale.date
                            )}
                          </p>
                        </div>

                        <div className="shrink-0">
                          {isEditing ? (
                            <SimpleSelect
                              value={saleEditForm.type || "varejo"}
                              onChange={(value) => setSaleEditForm((prev) => ({ ...prev, type: value }))}
                              options={[
                                { value: "atacado", label: "Atacado" },
                                { value: "varejo", label: "Varejo" },
                              ]}
                            />
                          ) : (
                            <span
                              className={`rounded-full border px-3 py-1 text-xs ${
                                sale.type === "atacado"
                                  ? "border-blue-400/20 bg-blue-500/15 text-blue-300"
                                  : "border-pink-400/20 bg-pink-500/15 text-pink-300"
                              }`}
                            >
                              {sale.type}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <MobileField label="Unidades">
                          {isEditing ? (
                            <RowInput type="number" value={saleEditForm.qty || ""} onChange={(e) => setSaleEditForm((prev) => ({ ...prev, qty: e.target.value }))} />
                          ) : (
                            sale.qty
                          )}
                        </MobileField>
                        <MobileField label="Preço" value={brl(sale.unitPrice)} />
                        <MobileField label="Receita" value={brl(sale.revenue)} />
                        <MobileField label="Lucro" value={brl(sale.profit)} />
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button className="rounded-xl border border-white/10 bg-white/5 p-2 text-emerald-300" onClick={() => saveSale(sale.id)}>
                              <Save className="h-4 w-4" />
                            </button>
                            <button className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/80" onClick={cancelEditSale}>
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="rounded-xl border border-white/10 bg-white/5 p-2 text-blue-300" onClick={() => startEditSale(sale)}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button className="rounded-xl border border-white/10 bg-white/5 p-2 text-red-300" onClick={() => deleteSale(sale.id)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-white/70">
                      <th className="p-3">Data</th>
                      <th className="p-3">Produto</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Unidades</th>
                      <th className="p-3">Preço</th>
                      <th className="p-3">Receita</th>
                      <th className="p-3">Lucro</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedSales.map((sale) => {
                      const isEditing = editingSaleId === sale.id;
                      return (
                        <tr key={sale.id} className="border-b border-white/10 align-middle">
                          <td className="p-3 text-white/90">
                            {isEditing ? (
                              <RowInput type="date" value={saleEditForm.date || ""} onChange={(e) => setSaleEditForm((prev) => ({ ...prev, date: e.target.value }))} className="w-[150px]" />
                            ) : (
                              sale.date
                            )}
                          </td>
                          <td className="max-w-[220px] p-3 break-words text-white/90">
                            {isEditing ? (
                              <SimpleSelect
                                value={saleEditForm.productId || ""}
                                onChange={(value) => setSaleEditForm((prev) => ({ ...prev, productId: value }))}
                                options={products.map((product) => ({ value: String(product.id), label: product.name }))}
                                className="w-[220px]"
                              />
                            ) : (
                              sale.product?.name
                            )}
                          </td>
                          <td className="p-3 capitalize text-white/80">
                            {isEditing ? (
                              <SimpleSelect
                                value={saleEditForm.type || "varejo"}
                                onChange={(value) => setSaleEditForm((prev) => ({ ...prev, type: value }))}
                                options={[
                                  { value: "atacado", label: "Atacado" },
                                  { value: "varejo", label: "Varejo" },
                                ]}
                                className="w-[130px]"
                              />
                            ) : (
                              sale.type
                            )}
                          </td>
                          <td className="p-3 text-white/90">
                            {isEditing ? (
                              <RowInput type="number" value={saleEditForm.qty || ""} onChange={(e) => setSaleEditForm((prev) => ({ ...prev, qty: e.target.value }))} className="w-20" />
                            ) : (
                              sale.qty
                            )}
                          </td>
                          <td className="p-3 text-white/90">{brl(sale.unitPrice)}</td>
                          <td className="p-3 text-white/90">{brl(sale.revenue)}</td>
                          <td className="p-3 text-emerald-300">{brl(sale.profit)}</td>
                          <td className="p-3">
                            <div className="flex justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button className="rounded-xl border border-white/10 bg-white/5 p-2 text-emerald-300" onClick={() => saveSale(sale.id)}>
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/80" onClick={cancelEditSale}>
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button className="rounded-xl border border-white/10 bg-white/5 p-2 text-blue-300" onClick={() => startEditSale(sale)}>
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button className="rounded-xl border border-white/10 bg-white/5 p-2 text-red-300" onClick={() => deleteSale(sale.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
              <h3 className="mb-4 flex items-center gap-2 text-white text-lg font-semibold">
                <Plus className="h-4 w-4" /> Nova venda
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-white/80">Data</label>
                  <input
                    type="date"
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none"
                    value={saleForm.date}
                    onChange={(e) => setSaleForm((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm text-white/80">Produto</label>
                  <SimpleSelect
                    value={saleForm.productId}
                    onChange={(value) => setSaleForm((prev) => ({ ...prev, productId: value }))}
                    options={[
                      { value: "", label: "Selecione" },
                      ...products.map((product) => ({ value: String(product.id), label: product.name })),
                    ]}
                    className="mt-2 h-11 w-full"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-white/80">Tipo</label>
                    <SimpleSelect
                      value={saleForm.type}
                      onChange={(value) => setSaleForm((prev) => ({ ...prev, type: value }))}
                      options={[
                        { value: "atacado", label: "Atacado" },
                        { value: "varejo", label: "Varejo" },
                      ]}
                      className="mt-2 h-11 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-white/80">Unidades</label>
                    <input
                      type="number"
                      className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none"
                      value={saleForm.qty}
                      onChange={(e) => setSaleForm((prev) => ({ ...prev, qty: e.target.value }))}
                    />
                  </div>
                </div>

                <button
                  onClick={addSale}
                  disabled={syncing}
                  className="w-full rounded-2xl bg-white py-3 font-semibold text-slate-900 transition hover:bg-white/90 disabled:opacity-60"
                >
                  Registrar venda
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "estoque" && (
          <div className="space-y-6">
            <SectionTitle
              icon={Package}
              title="Estoque inteligente"
              description="Ajuste o estoque editando a quantidade do produto na aba Produtos. O saldo atual recalcula automático."
            />

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {enrichedProducts.map((product) => {
                const pct = product.quantity > 0 ? (product.stockCurrent / product.quantity) * 100 : 0;
                const isLow = product.stockCurrent <= 5;

                return (
                  <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="h-full rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold leading-tight text-white">{product.name}</h3>
                          <p className="mt-1 text-sm text-white/60">Custo unitário {brl(product.costUnit)}</p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${
                            isLow
                              ? "border-amber-400/20 bg-amber-500/15 text-amber-300"
                              : "border-emerald-400/20 bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {isLow ? "Repor" : "OK"}
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <p className="text-xs text-white/50">Base</p>
                          <p className="mt-1 text-lg font-semibold text-white">{product.quantity}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <p className="text-xs text-white/50">Vendido</p>
                          <p className="mt-1 text-lg font-semibold text-white">{product.soldQty}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <p className="text-xs text-white/50">Atual</p>
                          <p className="mt-1 text-lg font-semibold text-white">{product.stockCurrent}</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-white/60">
                          <span>Nível de estoque</span>
                          <span>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2 text-xs text-white/55">
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        Vá em Produtos para alterar quantidade, custo ou preço.
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "testes" && (
          <div className="space-y-6">
            <SectionTitle icon={AlertTriangle} title="Validação interna" description="Testes simples do cálculo e da configuração segura do banco." />

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-white/70">
                      <th className="p-3">Teste</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Esperado</th>
                      <th className="p-3">Recebido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((test) => (
                      <tr key={test.name} className="border-b border-white/10">
                        <td className="p-3 text-white">{test.name}</td>
                        <td className="p-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs ${
                              test.passed
                                ? "border-emerald-400/20 bg-emerald-500/15 text-emerald-300"
                                : "border-red-400/20 bg-red-500/15 text-red-300"
                            }`}
                          >
                            {test.passed ? "OK" : "Falhou"}
                          </span>
                        </td>
                        <td className="p-3 text-white/80">{test.expected}</td>
                        <td className="p-3 text-white/80">{test.received}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
