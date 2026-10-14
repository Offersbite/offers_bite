import { useRef, useState } from 'react';
import { Icon } from '../../../components/Brand.jsx';
import { confirmAction, showToast } from '../../../services/alerts.js';

export function BulkUploadPanel({ kind, onUpload, onComplete, onDownloadTemplate, onBusyChange, children }) {
  const isCards = kind === 'cards';
  const input = useRef(null);
  const busy = useRef(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const accept = isCards ? '.csv,.xlsx' : '.xlsx';

  async function chooseFile(nextFile) {
    if (!nextFile || busy.current) return;
    setError('');
    setResult(null);
    setFile(null);
    let problem = '';
    if (!(isCards ? /\.(csv|xlsx)$/i : /\.xlsx$/i).test(nextFile.name)) problem = isCards ? 'Choose a CSV or Excel (.xlsx) file.' : 'Choose an Excel (.xlsx) file.';
    else if (nextFile.size > 10 * 1024 * 1024) problem = 'The file exceeds the 10 MB limit.';
    else if (!nextFile.size) problem = 'The file is empty. Add your rows and try again.';
    if (problem) { setError(problem); showToast(problem, 'error'); return; }
    setFile(nextFile);
    await importFile(nextFile);
  }

  async function importFile(selected = file) {
    if (!selected || busy.current) return;
    busy.current = true;
    onBusyChange?.(true);
    try {
      if (!await confirmAction({ title: `Import ${kind}?`, text: `Upload "${selected.name}" (${(selected.size / 1024).toFixed(1)} KB) to the ${isCards ? 'card catalogue' : 'offers catalogue'}?`, confirmText: `Import ${kind}` })) return;
      setUploading(true);
      setError('');
      setResult(null);
      try {
        const imported = await onUpload(selected);
        setResult(imported);
        setFile(null);
        showToast(isCards ? `${imported.cards_created} cards added. ${imported.duplicates_skipped} duplicates skipped.` : `${imported.rows_imported} offer rows imported.`);
        await onComplete();
      } catch (requestError) {
        setError(requestError.message);
        showToast(requestError.message, 'error');
        if (requestError.details?.result) setResult(requestError.details.result);
        else if (requestError.details?.errors) setResult({ errors: requestError.details.errors });
        // A failed or partial import can still have changed the catalogue.
        await onComplete();
      }
    } finally { busy.current = false; setUploading(false); onBusyChange?.(false); }
  }

  const stats = result && (isCards
    ? [[result.cards_created, 'Cards added'], [result.duplicates_skipped, 'Duplicates skipped'], [result.rows_total, 'Rows checked']]
    : [[result.rows_imported, 'Rows saved'], [result.card_matchable_rows, 'Rows linked to cards'], [result.unmatched_rows, 'Rows excluded from matching'], [result.cards_created, 'Cards added'], [result.rows_without_expiry, 'Without expiry'], [result.rows_total, 'Rows checked']]);
  const hasErrors = result?.errors?.length || result?.missing_rows?.length;
  return (
    <section id={`${kind}-bulk-upload`} className="card-bulk-panel" aria-labelledby={`${kind}-bulk-title`} aria-busy={uploading}>
      <div className="card-bulk-heading">
        <div><span className="card-bulk-eyebrow">BULK IMPORT</span><h3 id={`${kind}-bulk-title`}>Add your {isCards ? 'card catalogue' : 'offers'} in one upload</h3><p>Download the template, fill in your rows, then select a file to confirm the import.</p></div>
        <button className="button button-secondary" type="button" onClick={onDownloadTemplate}>Download {isCards ? 'CSV' : 'Excel'} template</button>
      </div>
      <div className="card-bulk-layout">
        <div className="card-bulk-file-area">
          <input ref={input} className="visually-hidden" type="file" accept={accept} disabled={uploading} onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = ''; }} />
          <button type="button" className={`card-bulk-dropzone${dragging ? ' is-dragging' : ''}`} disabled={uploading}
            onClick={() => input.current?.click()}
            onDragOver={(event) => { event.preventDefault(); if (!busy.current) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]); }}>
            <span className="card-bulk-upload-icon"><Icon name="upload" size={26} /></span>
            <strong>{file ? file.name : 'Drop your file here, or browse'}</strong>
            <span>{file ? `${(file.size / 1024).toFixed(1)} KB - Click to choose a different file` : `${isCards ? 'CSV or Excel (.xlsx)' : 'Excel (.xlsx)'} - Up to 10 MB - 10,000 rows`}</span>
          </button>
          <div className="card-bulk-submit">
            <span role="status">{uploading ? 'Uploading and checking your rows...' : file ? 'File selected. Ready to import.' : 'Select a file to get started.'}</span>
            <button className="button button-primary" type="button" onClick={() => importFile()} disabled={!file || uploading}><Icon name="upload" size={16} /> {uploading ? 'Importing...' : `Import ${kind}`}</button>
          </div>
        </div>
        <aside className="card-bulk-guide"><strong>What your file needs</strong>{children}</aside>
      </div>
      {error && <div className="admin-alert" role="alert">{error}</div>}
      {stats?.some(([value]) => value != null) && <div className="card-bulk-success" role="status"><strong><Icon name={hasErrors ? 'clock' : 'check'} size={17} /> {hasErrors ? 'Import needs review' : 'Import complete'}</strong><div className="card-bulk-stats">{stats.map(([value, label]) => value != null && <div key={label}><b>{value}</b><span>{label}</span></div>)}</div></div>}
      {hasErrors > 0 && <div className="card-bulk-errors" role="status"><strong>Review these rows and upload the corrected file</strong><div className="card-bulk-error-scroll"><table><thead><tr><th>Location</th><th>Issue</th></tr></thead><tbody>
        {result.errors?.map((item, index) => <tr key={`error-${index}`}><td>{item.sheet || 'File'}{item.row ? ` - Row ${item.row}` : ''}</td><td>{item.message}</td></tr>)}
        {result.missing_rows?.map((item, index) => <tr key={`missing-${index}`}><td>{item.sheet || 'File'} - Row {item.row}</td><td>Row was not imported.</td></tr>)}
      </tbody></table></div></div>}
    </section>
  );
}
