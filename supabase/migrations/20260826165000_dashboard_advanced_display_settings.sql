alter table public.admin_dashboard_preferences
  add column if not exists display_settings jsonb not null default '{"widget_order":["today","attention","pending","commercial","summary"],"widget_sizes":{"today":"normal","attention":"normal","pending":"normal","commercial":"normal","summary":"normal"},"widget_limits":{"today":4,"attention":5,"pending":4,"commercial":5,"summary":3},"hide_financial_values":false}'::jsonb;

comment on column public.admin_dashboard_preferences.display_settings is 'Preferências visuais do Painel 2.x: ordem, tamanho, limites e privacidade.';
