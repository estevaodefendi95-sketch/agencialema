interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
}

interface Column {
  id: string;
  slug: string;
  label: string;
  color?: string;
}

interface Member {
  user_id: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}

interface MediaItem {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
}

interface Props {
  projectName: string;
  companyName: string;
  appName: string;
  logoUrl: string | null;
  tasks: Task[];
  columns: Column[];
  members: Member[];
  mediaByTask?: Record<string, MediaItem[]>;
}

const PRIORITY_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const PRIORITY_COLORS: Record<string, string> = {
  baixa: "#64748b",
  media: "#3B82F6",
  alta: "#f59e0b",
  urgente: "#ef4444",
};

export default function PrintProjectView({
  projectName,
  companyName,
  appName,
  logoUrl,
  tasks,
  columns,
  members,
}: Props) {
  const memberName = (userId: string | null) => {
    if (!userId) return null;
    const m = members.find((mm) => mm.user_id === userId);
    return m?.profiles?.full_name || m?.profiles?.email || null;
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : null;

  const totalSelected = tasks.length;
  const generatedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="print-area print-only">
      {/* Capa / Cabeçalho */}
      <header
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #3B82F6 100%)",
          color: "#fff",
          padding: "32px 28px",
          borderRadius: 8,
          marginBottom: 28,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt="Logo"
            style={{
              height: 64,
              width: 64,
              objectFit: "contain",
              background: "#fff",
              borderRadius: 8,
              padding: 6,
            }}
          />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: 1, textTransform: "uppercase" }}>
            Relatório de Projeto
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: "4px 0 6px" }}>{projectName}</h1>
          {companyName && (
            <div style={{ fontSize: 14, opacity: 0.95 }}>Cliente: <strong>{companyName}</strong></div>
          )}
        </div>
        <div style={{ fontSize: 11, opacity: 0.9, textAlign: "right", lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600 }}>{appName}</div>
          <div>Emitido em</div>
          <div>{generatedAt}</div>
        </div>
      </header>

      {/* Resumo */}
      <section
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            flex: 1,
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Total de Tarefas
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>{totalSelected}</div>
        </div>
        {columns.slice(0, 3).map((col) => {
          const count = tasks.filter((t) => t.status === col.slug).length;
          return (
            <div
              key={col.id}
              style={{
                flex: 1,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "14px 16px",
                borderLeft: `4px solid ${col.color || "#3B82F6"}`,
              }}
            >
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {col.label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>{count}</div>
            </div>
          );
        })}
      </section>

      {/* Tarefas por coluna */}
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.slug);
        if (colTasks.length === 0) return null;
        return (
          <section key={col.id} className="print-column" style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#0f172a",
                paddingBottom: 8,
                marginBottom: 14,
                borderBottom: `2px solid ${col.color || "#3B82F6"}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: col.color || "#3B82F6",
                }}
              />
              {col.label}
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                ({colTasks.length} {colTasks.length === 1 ? "tarefa" : "tarefas"})
              </span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {colTasks.map((t, idx) => {
                const assignee = memberName(t.assigned_to);
                const due = formatDate(t.due_date);
                const prioColor = PRIORITY_COLORS[t.priority] || "#64748b";
                return (
                  <div
                    key={t.id}
                    className="print-card"
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "14px 16px",
                      background: "#fff",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                      <div
                        style={{
                          minWidth: 26,
                          height: 26,
                          borderRadius: 6,
                          background: "#f1f5f9",
                          color: "#475569",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a", lineHeight: 1.3 }}>
                          {t.title}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          color: "#fff",
                          background: prioColor,
                          padding: "3px 8px",
                          borderRadius: 999,
                        }}
                      >
                        {PRIORITY_LABELS[t.priority] || t.priority}
                      </span>
                    </div>
                    {t.description && (
                      <div
                        style={{
                          color: "#475569",
                          fontSize: 12,
                          lineHeight: 1.5,
                          marginLeft: 38,
                          marginBottom: 8,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {t.description}
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        marginLeft: 38,
                        fontSize: 11,
                        color: "#64748b",
                        flexWrap: "wrap",
                      }}
                    >
                      {due && (
                        <span>
                          📅 Prazo: <strong style={{ color: "#0f172a" }}>{due}</strong>
                        </span>
                      )}
                      {assignee && (
                        <span>
                          👤 Responsável: <strong style={{ color: "#0f172a" }}>{assignee}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Rodapé */}
      <footer
        style={{
          marginTop: 32,
          paddingTop: 16,
          borderTop: "1px solid #e2e8f0",
          fontSize: 10,
          color: "#94a3b8",
          textAlign: "center",
        }}
      >
        Documento gerado automaticamente por {appName} · {generatedAt}
      </footer>
    </div>
  );
}
