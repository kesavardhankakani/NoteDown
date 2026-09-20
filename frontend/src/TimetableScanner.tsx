import { useMemo, useRef, useState } from "react";

import {
  Camera,
  FileImage,
  Loader2,
  RotateCcw,
  Save,
  ScanLine,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import {
  importTimetable,
  scanTimetable,
  type Subject,
  type Timetable,
} from "./api";

type Entry = {
  day: string;
  slot?: number | null;
  start_time: string | null;
  end_time: string | null;
  subject_code: string | null;
  subject_name: string | null;
  short_name?: string | null;
  room?: string | null;
  faculty?: string | null;
  type?: string;
  label?: string | null;
  confidence?: number;
};

type Props = {
  subjects: Subject[];
  onImported?: (items: Timetable[]) => Promise<void> | void;
};

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const types = [
  "class",
  "lab",
  "library",
  "break",
  "free",
  "activity",
  "other",
];

export default function TimetableScanner({
  subjects,
  onImported,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [replace, setReplace] = useState(false);

  const subjectMap = useMemo(
    () =>
      new Map(
        subjects.map((s) => [
          s.code.toLowerCase(),
          s,
        ])
      ),
    [subjects]
  );

  function choose(f?: File) {
    if (!f) return;

    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      setMessage("Use JPG, PNG or WEBP.");
      return;
    }

    if (f.size > 20 * 1024 * 1024) {
      setMessage("Image must be 20 MB or smaller.");
      return;
    }

    // Release the previous object URL before creating a new one.
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));
    setEntries([]);
    setMeta({});
    setWarnings([]);
    setMessage("");
  }

  async function scan() {
    if (!file) {
      setMessage("Please choose a timetable image first.");
      return;
    }

    setBusy(true);
    setMessage("");
    setWarnings([]);

    try {
      const r = await scanTimetable(file);

      const t = r.timetable || {};

      const raw = (t.entries || []) as Entry[];

      const normalizedEntries = raw.map((x) => ({
        ...x,
        day: normalizeDay(x.day),
        start_time: x.start_time || "",
        end_time: x.end_time || "",
        subject_code: x.subject_code || "",
        subject_name: x.subject_name || "",
        room: x.room || "",
        faculty: x.faculty || "",
        type: x.type || "class",
        label: x.label || "",
      }));

      setEntries(normalizedEntries);
      setMeta(t);

      setWarnings([
        ...(t.warnings || []),
        ...(t.unrecognized_cells || []).map((x: any) =>
          typeof x === "string"
            ? x
            : JSON.stringify(x)
        ),
      ]);

      setMessage(
        `Scanned ${raw.length} timetable ${
          raw.length === 1 ? "entry" : "entries"
        }. Review them before saving.`
      );
    } catch (e) {
      console.error("TIMETABLE SCAN ERROR:", e);

      setMessage(
        e instanceof Error
          ? e.message
          : "Timetable scan failed."
      );
    } finally {
      setBusy(false);
    }
  }

  function update(
    i: number,
    key: keyof Entry,
    value: any
  ) {
    setEntries((xs) =>
      xs.map((x, n) =>
        n === i
          ? {
              ...x,
              [key]: value,
            }
          : x
      )
    );
  }

  function autoSubject(i: number) {
    const e = entries[i];

    const s = e.subject_code
      ? subjectMap.get(
          e.subject_code.toLowerCase()
        )
      : undefined;

    if (s) {
      update(i, "subject_name", s.name);
    }
  }

  async function save() {
    if (!entries.length) {
      setMessage(
        "No timetable entries available to import."
      );
      return;
    }

    setSaving(true);
    setMessage("");
    setWarnings([]);

    try {
      console.log(
        "TIMETABLE IMPORT REQUEST:",
        entries
      );

      const r = await importTimetable(
        entries,
        replace
      );

      console.log(
  "TIMETABLE IMPORT RESPONSE JSON:",
  JSON.stringify(r, null, 2)
);

      const importedItems =
        r.timetables || [];

      /*
       * Backend has successfully created the timetable.
       * Notify the parent so the main timetable UI
       * can refresh immediately.
       */
      if (onImported) {
        await onImported(importedItems);
      }

      if (r.created > 0) {
        setMessage(
          `Successfully imported ${r.created} timetable ${
            r.created === 1
              ? "entry"
              : "entries"
          }.`
        );
      } else {
        setMessage(
          "Import completed, but no new timetable entries were created."
        );
      }

      if (r.skipped > 0) {
        const skippedWarnings =
          (r.skipped_entries || []).map(
            (x: any) => {
              const reason =
                x?.reason ||
                "Entry skipped";

              const entry =
                x?.entry?.subject_code ||
                x?.entry?.subject_name ||
                "entry";

              return `${reason} — ${entry}`;
            }
          );

        setWarnings(skippedWarnings);
      }

      /*
       * Clear the scanner only when at least
       * one timetable entry was successfully saved.
       */
      if (r.created > 0) {
        setEntries([]);
        setMeta({});
        setReplace(false);

        if (preview) {
          URL.revokeObjectURL(preview);
        }

        setPreview("");
        setFile(null);

        /*
         * Reset the file input so the same image
         * can be selected again if required.
         */
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    } catch (e) {
      console.error(
        "TIMETABLE IMPORT ERROR:",
        e
      );

      setMessage(
        e instanceof Error
          ? e.message
          : "Could not import timetable."
      );
    } finally {
      setSaving(false);
    }
  }

  function clearScanner() {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setFile(null);
    setPreview("");
    setEntries([]);
    setMeta({});
    setWarnings([]);
    setMessage("");
    setReplace(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <section className="card timetable-ai-scanner">
      <div className="card-title">
        <ScanLine />

        <div>
          <h3>AI Timetable Scanner</h3>

          <p>
            Upload a timetable screenshot/photo.
            Groq Vision reads the grid, legend,
            periods, labs, rooms and faculty,
            then lets you correct the extracted
            entries before import. Subject master
            records are optional.
          </p>
        </div>
      </div>

      <div className="scanner-actions">
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) =>
            choose(e.target.files?.[0])
          }
        />

        <button
          className="primary"
          type="button"
          onClick={() =>
            inputRef.current?.click()
          }
        >
          <FileImage size={17} />
          Choose image
        </button>

        <button
          className="ghost"
          type="button"
          onClick={() =>
            inputRef.current?.click()
          }
        >
          <Camera size={17} />
          Camera
        </button>

        {file && (
          <button
            className="ghost"
            type="button"
            onClick={() => void scan()}
            disabled={busy}
          >
            {busy ? (
              <Loader2
                className="spin"
                size={17}
              />
            ) : (
              <ScanLine size={17} />
            )}

            {busy
              ? "Scanning…"
              : "Scan with AI"}
          </button>
        )}
      </div>

      {preview && (
        <div className="scanner-preview">
          <img
            src={preview}
            alt="Timetable preview"
          />

          <div>
            <b>{file?.name}</b>

            <small>
              {Math.round(
                (file?.size || 0) / 1024
              )}{" "}
              KB
            </small>

            <button
              className="ghost"
              type="button"
              onClick={clearScanner}
            >
              <RotateCcw size={15} />
              Clear
            </button>
          </div>
        </div>
      )}

      {meta.institution && (
        <div className="scanner-meta">
          <b>{meta.institution}</b>

          {meta.class_name && (
            <span>
              {meta.class_name}
            </span>
          )}

          {meta.effective_from && (
            <span>
              Effective{" "}
              {meta.effective_from}
            </span>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="scanner-warning">
          <TriangleAlert size={18} />

          <div>
            <b>Review warnings</b>

            {warnings
              .slice(0, 8)
              .map((w, i) => (
                <div key={i}>
                  {w}
                </div>
              ))}
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div className="scanner-toolbar">
            <b>
              {entries.length} extracted entries
            </b>

            <label>
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) =>
                  setReplace(
                    e.target.checked
                  )
                }
              />

              Replace my existing timetable
            </label>
          </div>

          <div className="scanner-table-wrap">
            <table className="scanner-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>
                    Subject / code
                  </th>
                  <th>Type</th>
                  <th>Room</th>
                  <th>Faculty</th>
                  <th>Confidence</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {entries.map(
                  (e, i) => (
                    <tr key={i}>
                      <td>
                        <select
                          value={e.day}
                          onChange={(x) =>
                            update(
                              i,
                              "day",
                              x.target.value
                            )
                          }
                        >
                          {days.map((d) => (
                            <option
                              key={d}
                              value={d}
                            >
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <div className="time-pair">
                          <input
                            type="time"
                            value={
                              e.start_time ||
                              ""
                            }
                            onChange={(x) =>
                              update(
                                i,
                                "start_time",
                                x.target.value
                              )
                            }
                          />

                          <input
                            type="time"
                            value={
                              e.end_time ||
                              ""
                            }
                            onChange={(x) =>
                              update(
                                i,
                                "end_time",
                                x.target.value
                              )
                            }
                          />
                        </div>
                      </td>

                      <td>
                        <input
                          value={e.subject_name || ""}
                          onChange={(x) =>
                            update(
                              i,
                              "subject_name",
                              x.target.value
                            )
                          }
                          placeholder="Subject / class name"
                        />

                        <input
                          value={e.subject_code || ""}
                          onChange={(x) =>
                            update(
                              i,
                              "subject_code",
                              x.target.value
                            )
                          }
                          placeholder="Subject code (optional)"
                        />

                        {e.subject_code && !e.subject_name && (
                          <button
                            className="ghost"
                            type="button"
                            onClick={() => autoSubject(i)}
                          >
                            Match existing subject
                          </button>
                        )}
                      </td>

                      <td>
                        <select
                          value={
                            e.type ||
                            "class"
                          }
                          onChange={(x) =>
                            update(
                              i,
                              "type",
                              x.target.value
                            )
                          }
                        >
                          {types.map((t) => (
                            <option
                              key={t}
                              value={t}
                            >
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          value={
                            e.room || ""
                          }
                          onChange={(x) =>
                            update(
                              i,
                              "room",
                              x.target.value
                            )
                          }
                          placeholder="Room / Lab"
                        />
                      </td>

                      <td>
                        <input
                          value={
                            e.faculty ||
                            ""
                          }
                          onChange={(x) =>
                            update(
                              i,
                              "faculty",
                              x.target.value
                            )
                          }
                          placeholder="Faculty"
                        />
                      </td>

                      <td>
                        {typeof e.confidence === "number" ? (
                          <span
                            className={
                              e.confidence >= 0.85
                                ? "confidence high"
                                : e.confidence >= 0.6
                                ? "confidence medium"
                                : "confidence low"
                            }
                          >
                            {Math.round(e.confidence * 100)}%
                          </span>
                        ) : (
                          <span className="confidence">—</span>
                        )}
                      </td>

                      <td>
                        <button
                          className="icon-btn danger"
                          type="button"
                          onClick={() =>
                            setEntries(
                              (xs) =>
                                xs.filter(
                                  (
                                    _,
                                    n
                                  ) =>
                                    n !==
                                    i
                                )
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <button
            className="primary"
            type="button"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? (
              <Loader2
                className="spin"
                size={17}
              />
            ) : (
              <Save size={17} />
            )}

            {saving
              ? "Saving…"
              : "Review complete — Import timetable"}
          </button>
        </>
      )}

      {message && (
        <div className="form-help">
          {message}
        </div>
      )}
    </section>
  );
}

function normalizeDay(v: any) {
  const s = String(v || "")
    .trim()
    .toLowerCase();

  return (
    days.find(
      (d) =>
        d.toLowerCase() === s
    ) ||
    days.find(
      (d) =>
        d
          .toLowerCase()
          .startsWith(
            s.slice(0, 3)
          )
    ) ||
    "Monday"
  );
}