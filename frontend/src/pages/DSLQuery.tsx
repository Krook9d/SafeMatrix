import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  Stack,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Tabs,
  Tab,
  Divider,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HistoryIcon from '@mui/icons-material/History';
import RefreshIcon from '@mui/icons-material/Refresh';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CategoryIcon from '@mui/icons-material/Category';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Drawer,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { opensearchAPI } from '../services/api';

const HISTORY_KEY = 'dsl_query_history_v1';

type QueryHistoryItem = {
  timestamp: number;
  index: string;
  query: string;
};

const PRESET_INDICES = ['alerts', 'hosts', 'inventories', 'vulnerabilities', '*'];

type TemplateItem = { label: string; index: string; query: any; description?: string };
type TemplateGroup = { title: string; items: TemplateItem[] };

const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    title: 'General',
    items: [
      { label: 'Everything (match_all)', index: '*', query: { query: { match_all: {} }, size: 10 } },
      { label: 'Top 100 by score desc (any index)', index: '*', query: { size: 100, sort: [{ _score: { order: 'desc' } }], query: { match_all: {} } } },
    ],
  },
  {
    title: 'Alerts',
    items: [
      { label: 'Recent alerts (open)', index: 'alerts', query: { size: 25, sort: [{ updated_at: { order: 'desc' } }], query: { term: { status: 'open' } } } },
      { label: 'Critical alerts (score >= 9)', index: 'alerts', query: { size: 50, query: { range: { score: { gte: 9 } } }, sort: [{ score: { order: 'desc' } }] } },
    ],
  },
  {
    title: 'Hosts',
    items: [
      { label: 'Windows hosts', index: 'hosts', query: { size: 50, query: { match_phrase: { 'os.name': 'Windows' } } } },
      { label: 'Recent hosts by updated_at', index: 'hosts', query: { size: 50, sort: [{ updated_at: { order: 'desc' } }], query: { match_all: {} } } },
    ],
  },
  {
    title: 'Inventories',
    items: [
      { label: 'Software: Mozilla', index: 'inventories', query: { size: 50, query: { match_phrase: { software_name: 'Mozilla' } } } },
      { label: 'With vulnerabilities only', index: 'inventories', query: { size: 50, query: { exists: { field: 'vulnerabilities' } } } },
    ],
  },
  {
    title: 'Vulnerabilities',
    items: [
      { label: 'CVSS baseScore >= 9', index: 'vulnerabilities', query: { size: 25, query: { range: { 'metrics.cvssMetricV31.cvssData.baseScore': { gte: 9 } } }, sort: [{ 'metrics.cvssMetricV31.cvssData.baseScore': { order: 'desc' } }] } },
      { label: 'Recently modified', index: 'vulnerabilities', query: { size: 25, sort: [{ lastModified: { order: 'desc' } }], query: { match_all: {} } } },
    ],
  },
  {
    title: 'Combined Indices',
    items: [
      { label: 'Alerts + Hosts (latest)', index: 'alerts,hosts', query: { size: 50, sort: [{ updated_at: { order: 'desc' } }], query: { match_all: {} } } },
      { label: 'Alerts + Inventories (latest)', index: 'alerts,inventories', query: { size: 50, sort: [{ updated_at: { order: 'desc' } }, { created_at: { order: 'desc' } }], query: { match_all: {} } } },
      { label: 'Hosts + Inventories (by hosts first)', index: 'hosts,inventories', query: { size: 100, sort: [{ 'os.name.keyword': { order: 'asc' } }], query: { match_all: {} } } },
    ],
  },
];

const DSLQuery: React.FC = () => {
  const [index, setIndex] = useState('');
  const defaultQuery = JSON.stringify({ query: { match_all: {} }, size: 10 }, null, 2);
  const [queryText, setQueryText] = useState(defaultQuery);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [tab, setTab] = useState<'raw' | 'table' | 'history'>('table');
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [sizeOverride, setSizeOverride] = useState<number | ''>('');
  const [docsOpen, setDocsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const DOCS_FIELDS: Record<string, string[]> = {
    alerts: [
      'host_id',
      'software_name',
      'version',
      'cve_id',
      'severity',
      'score',
      'status',
      'inventory_id',
      'description',
      'url',
      'created_at',
      'updated_at',
    ],
    hosts: [
      'hostname',
      'ip_address',
      'mac_address',
      'os.name',
      'os.version',
      'created_at',
      'updated_at',
    ],
    inventories: [
      'host_id',
      'software_name',
      'version',
      'install_date',
      'vulnerabilities',
      'created_at',
      'updated_at',
    ],
    vulnerabilities: [
      'id',
      'descriptions.value',
      'metrics.cvssMetricV31.cvssData.baseScore',
      'metrics.cvssMetricV31.cvssData.baseSeverity',
      'metrics.cvssMetricV31.exploitabilityScore',
      'metrics.cvssMetricV31.impactScore',
      'weaknesses_enriched.cweId',
      'weaknesses_enriched.cweName',
      'published',
      'lastModified',
    ],
    '*': [
      '_index',
      '_id',
      '_score',
    ],
  };

  const copyField = async (f: string) => {
    try {
      await navigator.clipboard.writeText(f);
    } catch {}
  };

  const downloadFile = (data: BlobPart, filename: string, type: string) => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!result) return;
    downloadFile(JSON.stringify(result, null, 2), `query-result-${Date.now()}.json`, 'application/json');
  };

  const toCSV = (rows: any[], columns: string[]): string => {
    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      const needsQuote = /[",\n]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needsQuote ? `"${escaped}"` : escaped;
    };
    const header = ['_index', '_id', ...columns].map(escape).join(',');
    const lines = rows.map((h) => {
      const src = h?._source || {};
      return [h._index, h._id, ...columns.map((c) => src?.[c])].map(escape).join(',');
    });
    return [header, ...lines].join('\n');
  };

  const exportCSV = () => {
    if (!hits.length) return;
    const csv = toCSV(hits, tableColumns);
    downloadFile(csv, `query-result-${Date.now()}.csv`, 'text/csv');
  };

  const runQuery = async () => {
    try {
      setLoading(true);
      setError(null);
      const bodyParsed = JSON.parse(queryText);
      const body =
        sizeOverride !== ''
          ? { ...bodyParsed, size: Number(sizeOverride) }
          : bodyParsed;
      const response = await opensearchAPI.query(index, body);
      setResult(response);
      // persist to history
      const item: QueryHistoryItem = { timestamp: Date.now(), index, query: JSON.stringify(body, null, 2) };
      const newHistory = [item, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch (err: any) {
      setError(err.message || 'Error executing query');
    } finally {
      setLoading(false);
    }
  };

  const onReset = () => {
    setIndex('');
    setQueryText(defaultQuery);
    setResult(null);
    setError(null);
    setJsonError(null);
    setSizeOverride('');
    setTab('table');
  };

  const applyTemplate = (tpl: TemplateItem) => {
    setIndex(tpl.index);
    setQueryText(JSON.stringify(tpl.query, null, 2));
  };

  const copyAsCurl = async () => {
    try {
      const url = `/api/v1/opensearch/query?index=${encodeURIComponent(index)}`;
      const data = JSON.parse(queryText);
      const curl = `curl -X POST \"${url}\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '${JSON.stringify(
        data
      )}'`;
      await navigator.clipboard.writeText(curl);
      setError(null);
    } catch (e: any) {
      setError('Impossible de copier la requête cURL.');
    }
  };

  useEffect(() => {
    // load history
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch (_) {}
  }, []);

  useEffect(() => {
    // validate JSON
    try {
      JSON.parse(queryText);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  }, [queryText]);

  const hits = useMemo(() => result?.hits?.hits ?? [], [result]);
  const summary = useMemo(() => {
    if (!result) return null;
    return {
      took: result.took,
      timed_out: result.timed_out,
      total: result?.hits?.total?.value ?? hits.length,
      shards: result?._shards,
    };
  }, [result, hits]);

  const tableColumns = useMemo(() => {
    if (!hits.length) return [] as string[];
    const firstSource = hits.find((h: any) => h?._source)?._source || {};
    const keys = Object.keys(firstSource);
    // Prefer some common keys
    const preferred = ['hostname', 'ip_address', 'software_name', 'version', 'cve_id', 'severity', 'score', 'updated_at', 'created_at'];
    const ordered = [...new Set([...preferred.filter(k => keys.includes(k)), ...keys])];
    return ordered.slice(0, 8);
  }, [hits]);

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4">OpenSearch DSL Query</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Templates">
            <IconButton onClick={() => setTemplatesOpen((v) => !v)}>
              <CategoryIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Copy as cURL">
            <span>
              <IconButton onClick={copyAsCurl} disabled={!!jsonError || !index}>
                <ContentCopyIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Reset">
            <IconButton onClick={onReset}>
              <DeleteOutlineIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle Docs">
            <IconButton onClick={() => setDocsOpen((v) => !v)}>
              <MenuBookIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
          <FormControl sx={{ minWidth: 220, maxWidth: 280 }}>
            <InputLabel id="index-label" shrink>Index</InputLabel>
            <Select
              labelId="index-label"
              label="Index"
              value={index}
              onChange={(e) => setIndex((e.target as HTMLInputElement).value as string)}
              displayEmpty
              renderValue={(val) => (val === '' ? <em>Custom…</em> : (val as string))}
            >
              <MenuItem value=""><em>Custom…</em></MenuItem>
              {PRESET_INDICES.map((name) => (
                <MenuItem key={name} value={name}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Custom index"
            placeholder="e.g., hosts, inventories, alerts, vulnerabilities, * or comma-separated"
            value={index}
            onChange={(e) => setIndex(e.target.value)}
            sx={{ minWidth: 260, maxWidth: 420, flex: 1 }}
          />
          <TextField
            label="Size (optional)"
            type="number"
            value={sizeOverride}
            onChange={(e) => setSizeOverride(e.target.value === '' ? '' : Number(e.target.value))}
            sx={{ width: 180 }}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>

        <TextField
          label="Query JSON"
          fullWidth
          multiline
          minRows={8}
          margin="normal"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          error={!!jsonError}
          helperText={jsonError ? `Invalid JSON: ${jsonError}` : 'Execute an OpenSearch DSL query.'}
          sx={{ fontFamily: 'monospace' }}
        />

        <Stack direction="row" spacing={1}>
          <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={runQuery} disabled={loading || !!jsonError || !index}>
            {loading ? 'Running…' : 'Run'}
          </Button>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => setQueryText(JSON.stringify(JSON.parse(queryText), null, 2))} disabled={!!jsonError}>
            Reformat JSON
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {summary && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
            <Stack direction="row" spacing={3} alignItems="center">
              <Typography variant="body2">Index: <b>{index || '(not specified)'}</b></Typography>
              <Typography variant="body2">Total: <b>{summary.total}</b></Typography>
              <Typography variant="body2">Took: <b>{summary.took} ms</b></Typography>
              <Typography variant="body2">Timed out: <b>{String(summary.timed_out)}</b></Typography>
              {loading && <CircularProgress size={18} />}
            </Stack>
            {!!hits.length && (
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={exportJSON}>Export JSON</Button>
                <Button size="small" variant="outlined" onClick={exportCSV}>Export CSV</Button>
              </Stack>
            )}
          </Stack>
        </Paper>
      )}

      {result && (
        <Paper sx={{ p: 0 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label={`Table (${hits.length})`} value="table" />
            <Tab label="Raw JSON" value="raw" />
            <Tab icon={<HistoryIcon />} iconPosition="start" label="History" value="history" />
          </Tabs>
          <Divider />

          {tab === 'table' && (
            <Box sx={{ p: 2, overflowX: 'auto' }}>
              {!hits.length ? (
                <Typography>No results.</Typography>
              ) : (
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #eee' }}>_index</th>
                      <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #eee' }}>_id</th>
                      {tableColumns.map((c) => (
                        <th key={c} style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #eee' }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hits.map((h: any, i: number) => (
                      <tr key={h._id || i}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #f3f3f3' }}>{h._index}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #f3f3f3' }}>{h._id}</td>
                        {tableColumns.map((c) => (
                          <td key={c} style={{ padding: '8px', borderBottom: '1px solid #f3f3f3' }}>
                            {String(h?._source?.[c] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Box>
          )}

          {tab === 'raw' && (
            <Box sx={{ p: 2, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </Box>
          )}

          {tab === 'history' && (
            <Box sx={{ p: 2 }}>
              {!history.length ? (
                <Typography>No history.</Typography>
              ) : (
                <Stack spacing={1}>
                  {history.map((h, i) => (
                    <Paper key={i} sx={{ p: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">{new Date(h.timestamp).toLocaleString()} — <b>{h.index}</b></Typography>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" onClick={() => { setIndex(h.index); setQueryText(h.query); }}>Load</Button>
                        </Stack>
                      </Stack>
                      <Box sx={{ mt: 1 }}>
                        <pre style={{ margin: 0, maxHeight: 160, overflow: 'auto' }}>{h.query}</pre>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </Paper>
      )}

      <Drawer anchor="right" open={docsOpen} onClose={() => setDocsOpen(false)} sx={{ '& .MuiDrawer-paper': { width: 360 } }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Index Field Reference</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Quick reference of common fields per index. Click a field to copy its path.
          </Typography>
          {Object.entries(DOCS_FIELDS).map(([idx, fields]) => (
            <Accordion key={idx} defaultExpanded={idx === (index || 'hosts')} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>{idx}</AccordionSummary>
              <AccordionDetails>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {fields.map((f) => (
                    <Chip key={f} label={f} size="small" onClick={() => copyField(f)} sx={{ mr: 1, mb: 1 }} />
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Drawer>

      <Drawer anchor="left" open={templatesOpen} onClose={() => setTemplatesOpen(false)} sx={{ '& .MuiDrawer-paper': { width: 420 } }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Templates</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Choose a template to populate the index and query.
          </Typography>
          {TEMPLATE_GROUPS.map((group, gIdx) => (
            <Accordion key={group.title} defaultExpanded={gIdx === 0} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>{group.title}</AccordionSummary>
              <AccordionDetails>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {group.items.map((t) => (
                    <Chip key={t.label} size="small" label={t.label} onClick={() => { applyTemplate(t); setTemplatesOpen(false); }} sx={{ mr: 1, mb: 1 }} />
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Drawer>
    </Box>
  );
};

export default DSLQuery;
