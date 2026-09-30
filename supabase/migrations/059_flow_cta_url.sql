-- ============================================================
-- 059_flow_cta_url.sql
--
-- Adds the 'send_cta_url' value to the `flow_nodes.node_type` CHECK
-- constraint: a WhatsApp "Call to Action URL" message (body + one
-- button that opens an external link, optional image / solid-color
-- header). Same drop-and-recreate pattern as migration 016. The node
-- config lives in JSONB and is shape-checked by the validator + TS
-- types, not the DB.
--
-- Automations need no migration: `automation_steps.step_type` has no
-- CHECK constraint.
--
-- Header images (uploaded or generated from a solid color) reuse the
-- existing public `flow-media` bucket — no storage changes.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE flow_nodes
  DROP CONSTRAINT IF EXISTS flow_nodes_node_type_check;

ALTER TABLE flow_nodes
  ADD CONSTRAINT flow_nodes_node_type_check
  CHECK (node_type IN (
    'start',
    'send_buttons',
    'send_list',
    'send_message',
    'send_media',
    'send_cta_url',
    'collect_input',
    'condition',
    'set_tag',
    'handoff',
    'http_fetch',
    'end'
  ));
