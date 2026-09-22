-- Cor manual da empresa: substitui a edição de cor por projeto. Todos os
-- projetos de uma empresa passam a usar essa mesma cor (fallback pra cor
-- automática/hash quando não definida). A coluna projects.color continua
-- existindo no banco, só deixou de ser editada/exibida no app.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS color text;
