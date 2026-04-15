import { useEffect, useState } from "react";
import { paymentApi } from "./storage";
import type { PaymentEntry, PaymentStatus, PaymentType } from "./types";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const monthOptions = [
  { short: "Jan", full: "Janeiro 2026" },
  { short: "Fev", full: "Fevereiro 2026" },
  { short: "Mar", full: "Marco 2026" },
  { short: "Abr", full: "Abril 2026" },
  { short: "Mai", full: "Maio 2026" },
  { short: "Jun", full: "Junho 2026" },
  { short: "Jul", full: "Julho 2026" },
  { short: "Ago", full: "Agosto 2026" }
];

const emptyForm = {
  person: "",
  category: "mensal" as PaymentType,
  description: "",
  amount: "",
  dueDay: "",
  monthLabel: "Abril 2026",
  status: "pendente" as PaymentStatus,
  note: ""
};

const categoryLabel: Record<PaymentType, string> = {
  mensal: "Mensais",
  provisorio: "Provisorios",
  temporario: "Temporarios"
};

const statusLabel: Record<PaymentStatus, string> = {
  pago: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado"
};

function buildDashboardData(entries: PaymentEntry[], activeMonth: string) {
  const monthlySeriesMap = new Map(
    monthOptions.map((month) => [month.full, { short: month.short, total: 0 }])
  );

  const summary = {
    filteredPayments: [] as PaymentEntry[],
    total: 0,
    paid: 0,
    pending: 0,
    monthlyTotal: 0,
    provisionalTotal: 0,
    temporaryTotal: 0
  };

  for (const entry of entries) {
    const monthBucket = monthlySeriesMap.get(entry.monthLabel);

    if (monthBucket) {
      monthBucket.total += entry.amount;
    }

    if (entry.monthLabel !== activeMonth) {
      continue;
    }

    summary.filteredPayments.push(entry);
    summary.total += entry.amount;

    if (entry.status === "pago") {
      summary.paid += entry.amount;
    } else {
      summary.pending += entry.amount;
    }

    if (entry.category === "mensal") {
      summary.monthlyTotal += entry.amount;
    } else if (entry.category === "provisorio") {
      summary.provisionalTotal += entry.amount;
    } else {
      summary.temporaryTotal += entry.amount;
    }
  }

  return {
    ...summary,
    monthlySeries: monthOptions.map((month) => monthlySeriesMap.get(month.full)!),
    maxSeriesValue: Math.max(...Array.from(monthlySeriesMap.values(), (item) => item.total), 1)
  };
}

function App() {
  const [selectedMonth, setSelectedMonth] = useState("Abr");
  const [entries, setEntries] = useState<PaymentEntry[]>([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState(
    "Os dados podem ser exportados para o arquivo JSON e versionados no GitHub."
  );
  const [form, setForm] = useState({
    ...emptyForm,
    monthLabel: "Abril 2026"
  });

  useEffect(() => {
    paymentApi.getPayments().then(setEntries);
  }, []);

  useEffect(() => {
    const activeMonth = monthOptions.find((month) => month.short === selectedMonth)?.full;

    if (activeMonth && !editingId) {
      setForm((current) => ({
        ...current,
        monthLabel: activeMonth
      }));
    }
  }, [selectedMonth, editingId]);

  const activeMonth =
    monthOptions.find((month) => month.short === selectedMonth)?.full ?? "Abril 2026";
  const {
    filteredPayments,
    total,
    paid,
    pending,
    monthlyTotal,
    provisionalTotal,
    temporaryTotal,
    monthlySeries,
    maxSeriesValue
  } = buildDashboardData(entries, activeMonth);

  const progress = total === 0 ? 0 : Math.round((paid / total) * 100);
  const progressStyle = {
    background: `conic-gradient(#ffffff ${progress * 3.6}deg, #2d2d2d 0deg)`
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      person: form.person.trim(),
      category: form.category,
      description: form.description.trim(),
      amount: Number(form.amount),
      dueDay: Number(form.dueDay),
      monthLabel: form.monthLabel,
      status: form.status,
      note: form.note.trim()
    };

    if (!payload.person || !payload.description || !payload.amount || !payload.dueDay) {
      return;
    }

    const nextEntries = editingId
      ? await paymentApi.updatePayment(editingId, payload)
      : await paymentApi.addPayment(payload);

    setEntries(nextEntries);
    setEditingId(null);
    setForm({
      ...emptyForm,
      monthLabel: activeMonth
    });
    setIsComposerOpen(false);
  }

  function handleChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleEdit(entry: PaymentEntry) {
    setEditingId(entry.id);
    setForm({
      person: entry.person,
      category: entry.category,
      description: entry.description,
      amount: String(entry.amount),
      dueDay: String(entry.dueDay),
      monthLabel: entry.monthLabel,
      status: entry.status,
      note: entry.note ?? ""
    });
    setIsComposerOpen(true);
  }

  async function handleDelete(id: string) {
    const nextEntries = await paymentApi.deletePayment(id);
    setEntries(nextEntries);
    if (editingId === id) {
      setEditingId(null);
      setForm({
        ...emptyForm,
        monthLabel: activeMonth
      });
      setIsComposerOpen(false);
    }
  }

  function openComposer() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      monthLabel: activeMonth
    });
    setIsComposerOpen(true);
  }

  function closeComposer() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      monthLabel: activeMonth
    });
    setIsComposerOpen(false);
  }

  function handleExport() {
    const payload = JSON.stringify(paymentApi.exportPayments(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "payments.json";
    anchor.click();

    URL.revokeObjectURL(url);
    setSyncMessage("Arquivo exportado. Substitua public/payments.json no GitHub quando quiser publicar.");
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const imported = JSON.parse(content) as PaymentEntry[];
      const nextEntries = await paymentApi.importPayments(imported);

      setEntries(nextEntries);
      setSyncMessage("Arquivo importado com sucesso. O painel agora usa os dados desse JSON.");
    } catch {
      setSyncMessage("Nao foi possivel importar esse arquivo. Verifique se ele e um payments.json valido.");
    }

    event.target.value = "";
  }

  async function handleReloadFromGithubFile() {
    const nextEntries = await paymentApi.clearLocalCache();
    setEntries(nextEntries);
    setSyncMessage("Cache local limpo. Os dados foram recarregados do payments.json publicado.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar fade-in fade-delay-1">
        <div className="brand">PF</div>
        <div className="sidebar-title">Orcamento</div>
        <nav className="month-nav" aria-label="Selecionar mes">
          {monthOptions.map((month) => (
            <button
              key={month.short}
              type="button"
              className={month.short === selectedMonth ? "month-item active" : "month-item"}
              onClick={() => setSelectedMonth(month.short)}
            >
              {month.short}
            </button>
          ))}
        </nav>
      </aside>

      <main className="dashboard">
        <header className="topbar fade-in fade-delay-2">
          <div className="date-chip">{activeMonth}</div>
          <div className="topbar-actions">
            <button type="button" className="primary-action" onClick={openComposer}>
              Novo gasto
            </button>
            <div className="profile-chip">
              <div>
                <strong>Controle Financeiro</strong>
                <span>Painel pessoal</span>
              </div>
              <div className="avatar">M</div>
            </div>
          </div>
        </header>

        <section className="content-grid">
          <div className="left-column">
            <div className="card hero-card fade-in fade-delay-3">
              <span className="card-label">Patrimonio do mes</span>
              <strong>{currency.format(total)}</strong>
              <p className="hero-caption">Tudo que voce registrou para {selectedMonth}.</p>
            </div>

            <div className="card chart-card fade-in fade-delay-4">
              <div className="card-head">
                <div>
                  <span className="card-label">Pagamentos mensais</span>
                  <strong>{currency.format(monthlyTotal)}</strong>
                </div>
                <span className="card-note">Credito e contas fixas</span>
              </div>
              <div className="wave wave-one" aria-hidden="true" />
            </div>

            <div className="card chart-card fade-in fade-delay-5">
              <div className="card-head">
                <div>
                  <span className="card-label">Pagamentos provisorios</span>
                  <strong>{currency.format(provisionalTotal)}</strong>
                </div>
                <span className="card-note">Pessoas fisicas</span>
              </div>
              <div className="wave wave-two" aria-hidden="true" />
            </div>

            <div className="card chart-card fade-in fade-delay-6">
              <div className="card-head">
                <div>
                  <span className="card-label">Pagamentos temporarios</span>
                  <strong>{currency.format(temporaryTotal)}</strong>
                </div>
                <span className="card-note">Minimos de ate R$ 100</span>
              </div>
              <div className="wave wave-three" aria-hidden="true" />
            </div>

            <section className="card analytics-card fade-in fade-delay-7">
              <div className="card-head">
                <div>
                  <span className="card-label">Grafico mensal</span>
                  <strong>Comparativo dos meses</strong>
                </div>
                <span className="card-note">Leitura rapida</span>
              </div>

              <div className="bars">
                {monthlySeries.map((item) => {
                  const barHeight = `${Math.max((item.total / maxSeriesValue) * 100, 8)}%`;

                  return (
                    <div
                      key={item.short}
                      className={item.short === selectedMonth ? "bar-item active" : "bar-item"}
                    >
                      <div className="bar-track">
                        <div className="bar-fill" style={{ height: barHeight }} />
                      </div>
                      <strong>{item.short}</strong>
                      <span>{currency.format(item.total)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="right-column">
            <div className="card ring-card fade-in fade-delay-4">
              <div className="ring-shell">
                <div className="ring-outer" style={progressStyle}>
                  <div className="ring-inner">
                    <strong>{progress}%</strong>
                    <span>Quitado</span>
                  </div>
                </div>
              </div>

              <div className="ring-stats">
                <div>
                  <span>Pagos</span>
                  <strong>{currency.format(paid)}</strong>
                </div>
                <div>
                  <span>Em aberto</span>
                  <strong>{currency.format(pending)}</strong>
                </div>
              </div>
            </div>

            <div className="card compact-card fade-in fade-delay-5">
              <span className="card-label">GitHub JSON</span>
              <strong>Adicionar, editar, remover e versionar em arquivo.</strong>
              <p>{syncMessage}</p>
              <div className="sync-actions">
                <button type="button" className="ghost-action" onClick={handleExport}>
                  Exportar JSON
                </button>
                <label className="file-action">
                  <input type="file" accept="application/json" onChange={handleImport} />
                  Importar JSON
                </label>
                <button type="button" className="ghost-action" onClick={handleReloadFromGithubFile}>
                  Recarregar base
                </button>
              </div>
            </div>

            <section className="card history-card fade-in fade-delay-6">
              <div className="card-head">
                <div>
                  <span className="card-label">Historico</span>
                  <strong>{filteredPayments.length} lancamentos</strong>
                </div>
              </div>

              <div className="history-list">
                {filteredPayments.map((payment) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    onEdit={() => handleEdit(payment)}
                    onDelete={() => handleDelete(payment.id)}
                  />
                ))}
              </div>
            </section>
          </div>
        </section>

        {isComposerOpen ? (
          <div className="composer-overlay" onClick={closeComposer}>
            <section
              className="composer-panel fade-in"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="composer-head">
                <div>
                  <span className="card-label">
                    {editingId ? "Atualizar gasto" : "Adicionar gasto"}
                  </span>
                  <strong>{editingId ? "Editar lancamento" : "Cadastrar novo lancamento"}</strong>
                </div>
                <button type="button" className="ghost-action" onClick={closeComposer}>
                  Fechar
                </button>
              </div>

              <form className="composer-form" onSubmit={handleSubmit}>
                <label>
                  <span>Nome</span>
                  <input
                    value={form.person}
                    onChange={(event) => handleChange("person", event.target.value)}
                    placeholder="Ex.: Carlos Henrique"
                  />
                </label>

                <label>
                  <span>Categoria</span>
                  <select
                    value={form.category}
                    onChange={(event) =>
                      handleChange("category", event.target.value as PaymentType)
                    }
                  >
                    <option value="mensal">Pagamentos mensais</option>
                    <option value="provisorio">Pagamentos provisorios</option>
                    <option value="temporario">Pagamentos temporarios</option>
                  </select>
                </label>

                <label>
                  <span>Descricao</span>
                  <input
                    value={form.description}
                    onChange={(event) => handleChange("description", event.target.value)}
                    placeholder="Ex.: Fatura do cartao"
                  />
                </label>

                <label>
                  <span>Valor</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => handleChange("amount", event.target.value)}
                    placeholder="0.00"
                  />
                </label>

                <label>
                  <span>Vencimento</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.dueDay}
                    onChange={(event) => handleChange("dueDay", event.target.value)}
                    placeholder="15"
                  />
                </label>

                <label>
                  <span>Mes</span>
                  <select
                    value={form.monthLabel}
                    onChange={(event) => handleChange("monthLabel", event.target.value)}
                  >
                    {monthOptions.map((month) => (
                      <option key={month.full} value={month.full}>
                        {month.full}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      handleChange("status", event.target.value as PaymentStatus)
                    }
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="atrasado">Atrasado</option>
                  </select>
                </label>

                <label className="full-width">
                  <span>Observacao</span>
                  <textarea
                    rows={4}
                    value={form.note}
                    onChange={(event) => handleChange("note", event.target.value)}
                    placeholder="Detalhes opcionais"
                  />
                </label>

                <div className="composer-actions full-width">
                  <button type="button" className="ghost-action" onClick={closeComposer}>
                    Cancelar
                  </button>
                  <button type="submit" className="primary-action">
                    {editingId ? "Atualizar" : "Salvar"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function PaymentRow({
  payment,
  onEdit,
  onDelete
}: {
  payment: PaymentEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="payment-row">
      <div className="payment-copy">
        <strong>{payment.person}</strong>
        <span>
          {categoryLabel[payment.category]} . Dia {payment.dueDay} . {statusLabel[payment.status]}
        </span>
      </div>

      <div className="payment-side">
        <strong>{currency.format(payment.amount)}</strong>
        <div className="row-actions">
          <button type="button" className="inline-action" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="inline-action danger" onClick={onDelete}>
            Excluir
          </button>
        </div>
      </div>
    </article>
  );
}

export default App;
