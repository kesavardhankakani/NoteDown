import { useMemo, useState } from "react";
import {
  CalendarDays,
  Calculator,
  CheckCircle2,
  CircleAlert,
  GraduationCap,
  Info,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TriangleAlert,
} from "lucide-react";

import {
  saveAttendanceSettings,
  type AttendanceSummary,
  type Timetable,
} from "./api";

type Props = {
  summary: AttendanceSummary[];
  timetable: Timetable[];
  minimum: number;
  onRefresh?: () => Promise<void>;
};

type Mode = "manual" | "recorded";

type UpcomingClass = {
  key: string;
  timetable: Timetable;
  date: string;
  dateLabel: string;
  dayLabel: string;
  isToday: boolean;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function normalizeDay(value?: string) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "");
}

function matchesDay(date: Date, day?: string) {
  const normalized = normalizeDay(day);

  const names: Record<number, string[]> = {
    0: ["sun", "sunday"],
    1: ["mon", "monday"],
    2: ["tue", "tues", "tuesday"],
    3: ["wed", "wednesday"],
    4: ["thu", "thur", "thurs", "thursday"],
    5: ["fri", "friday"],
    6: ["sat", "saturday"],
  };

  return names[date.getDay()].includes(normalized);
}

function timeToMinutes(value?: string) {
  if (!value) return 0;

  const parts = value.split(":").map(Number);

  if (parts.length < 2) return 0;

  return parts[0] * 60 + parts[1];
}

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isClassAlreadyStartedOrFinished(
  date: Date,
  timetable: Timetable
) {
  const today = new Date();

  const sameDate =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (!sameDate) return false;

  return timeToMinutes(timetable.end_time) <= getNowMinutes();
}

function safeNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function percentage(present: number, conducted: number) {
  if (conducted <= 0) return 0;
  return (present / conducted) * 100;
}

function rounded(value: number) {
  return Number(value.toFixed(1));
}

function calculatePresentFromPercentage(
  attendancePercentage: number,
  conducted: number
) {
  if (conducted <= 0) return 0;

  return Math.round(
    (attendancePercentage / 100) * conducted
  );
}

export default function BunkPlannerPro({
  summary,
  timetable,
  minimum,
  onRefresh,
}: Props) {
  const currentDate = dateKey(new Date());

  const [mode, setMode] = useState<Mode>("manual");

  const noteDownCurrent = useMemo(() => {
    const present = summary.reduce(
      (total, item) => total + Number(item.present || 0),
      0
    );

    const conducted = summary.reduce(
      (total, item) => total + Number(item.total || 0),
      0
    );

    return {
      present,
      conducted,
      percentage: percentage(present, conducted),
    };
  }, [summary]);

  const [manualPercentage, setManualPercentage] =
    useState<number>(80);

  const [manualConducted, setManualConducted] =
    useState<number>(25);

  const [target, setTarget] =
    useState<number>(minimum || 75);

  const [lookAhead, setLookAhead] =
    useState<number>(7);

  const [selectedClasses, setSelectedClasses] =
    useState<string[]>([]);

  const [calculated, setCalculated] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [showAllClasses, setShowAllClasses] =
    useState(false);

  /*
   * ----------------------------------------------------------
   * CURRENT ATTENDANCE
   * ----------------------------------------------------------
   */

  const currentStats = useMemo(() => {
    if (mode === "recorded") {
      return {
        percentage: noteDownCurrent.percentage,
        conducted: noteDownCurrent.conducted,
        present: noteDownCurrent.present,
      };
    }

    const conducted = Math.max(
      0,
      Math.round(safeNumber(manualConducted, 0))
    );

    const percentageValue = Math.min(
      100,
      Math.max(
        0,
        safeNumber(manualPercentage, 0)
      )
    );

    const present = calculatePresentFromPercentage(
      percentageValue,
      conducted
    );

    return {
      percentage: percentage(
        present,
        conducted
      ),
      conducted,
      present,
    };
  }, [
    mode,
    noteDownCurrent,
    manualPercentage,
    manualConducted,
  ]);

  /*
   * ----------------------------------------------------------
   * UPCOMING REAL TIMETABLE CLASSES
   * ----------------------------------------------------------
   */

  const upcomingClasses = useMemo<UpcomingClass[]>(() => {
    const output: UpcomingClass[] = [];

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    for (
      let offset = 0;
      offset < Math.max(1, lookAhead);
      offset++
    ) {
      const date = new Date(start);

      date.setDate(
        start.getDate() + offset
      );

      for (const item of timetable) {
        if (!matchesDay(date, item.day_of_week)) {
          continue;
        }

        if (
          isClassAlreadyStartedOrFinished(
            date,
            item
          )
        ) {
          continue;
        }

        const key = `${dateKey(date)}-${item.id}`;

        output.push({
          key,
          timetable: item,
          date: dateKey(date),
          dateLabel: formatDate(date),
          dayLabel: date.toLocaleDateString(
            undefined,
            { weekday: "short" }
          ),
          isToday: offset === 0,
        });
      }
    }

    return output.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }

      return (
        timeToMinutes(
          a.timetable.start_time
        ) -
        timeToMinutes(
          b.timetable.start_time
        )
      );
    });
  }, [timetable, lookAhead]);

  /*
   * ----------------------------------------------------------
   * CALCULATION
   * ----------------------------------------------------------
   */

  const calculation = useMemo(() => {
    const selectedCount =
      selectedClasses.length;

    const present =
      currentStats.present;

    const conducted =
      currentStats.conducted;

    const afterConducted =
      conducted + selectedCount;

    const afterPresent =
      present;

    const afterPercentage =
      percentage(
        afterPresent,
        afterConducted
      );

    const loss =
      currentStats.percentage -
      afterPercentage;

    let maximumSafeBunks = 0;

    if (conducted > 0) {
      /*
       * We calculate how many future classes
       * can be missed while staying >= target.
       */
      for (
        let bunkCount = 0;
        bunkCount <= 1000;
        bunkCount++
      ) {
        const futurePercentage =
          percentage(
            present,
            conducted + bunkCount
          );

        if (
          futurePercentage >= target
        ) {
          maximumSafeBunks =
            bunkCount;
        } else {
          break;
        }
      }
    }

    const remainingSafeBunks =
      Math.max(
        0,
        maximumSafeBunks -
          selectedCount
      );

    const selectedClassDetails =
      upcomingClasses.filter((item) =>
        selectedClasses.includes(item.key)
      );

    return {
      selectedCount,
      present,
      conducted,
      afterConducted,
      afterPercentage,
      loss,
      maximumSafeBunks,
      remainingSafeBunks,
      selectedClassDetails,
      safe:
        afterPercentage >= target,
    };
  }, [
    selectedClasses,
    currentStats,
    target,
    upcomingClasses,
  ]);

  /*
   * ----------------------------------------------------------
   * HANDLERS
   * ----------------------------------------------------------
   */

  function toggleClass(key: string) {
    setSelectedClasses((previous) =>
      previous.includes(key)
        ? previous.filter(
            (item) => item !== key
          )
        : [...previous, key]
    );

    setCalculated(false);
  }

  function clearSelection() {
    setSelectedClasses([]);
    setCalculated(false);
  }

  function selectSafeBunks() {
    const safeCount =
      calculation.maximumSafeBunks;

    const keys = upcomingClasses
      .slice(0, safeCount)
      .map((item) => item.key);

    setSelectedClasses(keys);
    setCalculated(true);
  }

  function resetSimulator() {
    setSelectedClasses([]);
    setCalculated(false);
    setManualPercentage(80);
    setManualConducted(25);
    setTarget(minimum || 75);
    setLookAhead(7);
    setMode("manual");
  }

  async function saveTarget() {
    setSaving(true);

    try {
      await saveAttendanceSettings({
        minimum_percentage: target,
      });

      await onRefresh?.();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not save target"
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ----------------------------------------------------------
   * DISPLAY VALUES
   * ----------------------------------------------------------
   */

  const visibleClasses =
    showAllClasses
      ? upcomingClasses
      : upcomingClasses.slice(0, 7);

  const currentIsBelowTarget =
    currentStats.percentage <
    target;

  const projectedIsBelowTarget =
    selectedClasses.length > 0 &&
    calculation.afterPercentage <
      target;

  /*
   * ----------------------------------------------------------
   * UI
   * ----------------------------------------------------------
   */

  return (
    <div className="bunk-simulator-page">
      <style>{`
        .bunk-simulator-page {
          --bs-bg: #f5f7fb;
          --bs-card: #ffffff;
          --bs-text: #172033;
          --bs-muted: #68758a;
          --bs-border: #dfe5ef;
          --bs-primary: #172033;
          --bs-primary-soft: #eef3ff;
          --bs-blue: #2563eb;
          --bs-green: #0f9f6e;
          --bs-green-soft: #eafaf4;
          --bs-red: #dc3545;
          --bs-red-soft: #fff0f2;
          --bs-yellow: #b7791f;
          --bs-yellow-soft: #fff8e7;

          width: 100%;
          box-sizing: border-box;
          padding: 24px;
          color: var(--bs-text);
          background:
            radial-gradient(
              circle at 10% 0%,
              rgba(37, 99, 235, 0.07),
              transparent 28%
            ),
            var(--bs-bg);
          min-height: 100%;
        }

        .bunk-simulator-page *,
        .bunk-simulator-page *::before,
        .bunk-simulator-page *::after {
          box-sizing: border-box;
        }

        .bs-container {
          max-width: 1420px;
          margin: 0 auto;
        }

        .bs-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 22px;
        }

        .bs-hero-left {
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }

        .bs-hero-icon {
          width: 48px;
          height: 48px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          color: #ffffff;
          background: linear-gradient(
            135deg,
            #2563eb,
            #7c3aed
          );
          box-shadow:
            0 10px 25px rgba(
              37,
              99,
              235,
              0.22
            );
        }

        .bs-hero h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.15;
          letter-spacing: -0.5px;
        }

        .bs-hero p {
          margin: 7px 0 0;
          color: var(--bs-muted);
          font-size: 14px;
        }

        .bs-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 12px;
          border-radius: 999px;
          background: #ffffff;
          border: 1px solid var(--bs-border);
          color: var(--bs-muted);
          font-size: 12px;
          font-weight: 700;
        }

        .bs-layout {
          display: grid;
          grid-template-columns:
            minmax(0, 1.65fr)
            minmax(330px, 0.8fr);
          gap: 20px;
          align-items: start;
        }

        .bs-left,
        .bs-right {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .bs-card {
          background: var(--bs-card);
          border: 1px solid var(--bs-border);
          border-radius: 18px;
          box-shadow:
            0 8px 30px rgba(
              16,
              24,
              40,
              0.045
            );
          padding: 20px;
        }

        .bs-card-title {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-bottom: 18px;
        }

        .bs-card-title-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: var(--bs-primary-soft);
          color: var(--bs-blue);
          flex: 0 0 auto;
        }

        .bs-card-title h2,
        .bs-card-title h3 {
          margin: 0;
          font-size: 17px;
        }

        .bs-card-title p {
          margin: 5px 0 0;
          color: var(--bs-muted);
          font-size: 13px;
          line-height: 1.45;
        }

        .bs-mode-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .bs-mode {
          position: relative;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          text-align: left;
          padding: 15px;
          border: 1px solid var(--bs-border);
          border-radius: 14px;
          background: #ffffff;
          cursor: pointer;
          transition:
            border-color 0.15s ease,
            background 0.15s ease,
            transform 0.15s ease;
        }

        .bs-mode:hover {
          transform: translateY(-1px);
          border-color: #a9bce7;
        }

        .bs-mode.active {
          border-color: var(--bs-blue);
          background: #f4f7ff;
          box-shadow:
            0 0 0 3px rgba(
              37,
              99,
              235,
              0.08
            );
        }

        .bs-radio {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid #b8c2d3;
          margin-top: 2px;
          position: relative;
          flex: 0 0 auto;
        }

        .bs-mode.active .bs-radio {
          border-color: var(--bs-blue);
        }

        .bs-mode.active .bs-radio::after {
          content: "";
          position: absolute;
          inset: 3px;
          border-radius: 50%;
          background: var(--bs-blue);
        }

        .bs-mode-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          background: #edf4ff;
          color: var(--bs-blue);
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }

        .bs-mode strong {
          display: block;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .bs-mode span {
          display: block;
          color: var(--bs-muted);
          font-size: 12px;
          line-height: 1.45;
        }

        .bs-fields {
          display: grid;
          grid-template-columns:
            1fr
            1fr
            1fr
            1fr;
          gap: 12px;
        }

        .bs-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .bs-field label {
          font-size: 12px;
          font-weight: 700;
          color: #4f5c70;
        }

        .bs-input-wrap {
          position: relative;
        }

        .bs-input {
          width: 100%;
          height: 44px;
          border: 1px solid #d3dbe8;
          border-radius: 11px;
          padding: 0 13px;
          outline: none;
          background: #ffffff;
          color: var(--bs-text);
          font-size: 14px;
          font-weight: 600;
        }

        .bs-input:focus {
          border-color: var(--bs-blue);
          box-shadow:
            0 0 0 3px rgba(
              37,
              99,
              235,
              0.09
            );
        }

        .bs-percent-input {
          padding-right: 35px;
        }

        .bs-input-suffix {
          position: absolute;
          right: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--bs-muted);
          font-weight: 700;
          font-size: 13px;
          pointer-events: none;
        }

        .bs-note {
          margin-top: 12px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 11px 12px;
          border-radius: 11px;
          background: #f6f8fc;
          color: var(--bs-muted);
          font-size: 12px;
          line-height: 1.45;
        }

        .bs-note svg {
          flex: 0 0 auto;
          margin-top: 1px;
        }

        .bs-class-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 13px;
        }

        .bs-class-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .bs-count {
          padding: 7px 10px;
          border-radius: 999px;
          background: #eef4ff;
          color: #2459bd;
          font-size: 11px;
          font-weight: 800;
        }

        .bs-class-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .bs-class {
          display: grid;
          grid-template-columns:
            24px
            minmax(170px, 1.25fr)
            minmax(130px, 1fr)
            minmax(90px, 0.7fr)
            auto;
          gap: 12px;
          align-items: center;
          padding: 12px;
          border: 1px solid #e1e6ee;
          border-radius: 13px;
          background: #ffffff;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .bs-class:hover {
          border-color: #b9c7df;
          background: #fbfcff;
        }

        .bs-class.selected {
          border-color: var(--bs-blue);
          background: #f3f7ff;
          box-shadow:
            0 0 0 2px rgba(
              37,
              99,
              235,
              0.07
            );
        }

        .bs-check {
          width: 19px;
          height: 19px;
          border: 2px solid #bac5d5;
          border-radius: 5px;
          display: grid;
          place-items: center;
          color: #ffffff;
        }

        .bs-class.selected .bs-check {
          border-color: var(--bs-blue);
          background: var(--bs-blue);
        }

        .bs-class-main strong {
          display: block;
          font-size: 13px;
          margin-bottom: 3px;
        }

        .bs-class-main span {
          color: var(--bs-muted);
          font-size: 11px;
        }

        .bs-class-time {
          color: #46546b;
          font-size: 12px;
          font-weight: 700;
        }

        .bs-class-room {
          color: var(--bs-muted);
          font-size: 11px;
        }

        .bs-class-date {
          text-align: right;
          font-size: 11px;
          color: var(--bs-muted);
          white-space: nowrap;
        }

        .bs-class-date strong {
          display: block;
          color: var(--bs-text);
          font-size: 12px;
          margin-bottom: 2px;
        }

        .bs-today {
          color: var(--bs-blue);
        }

        .bs-empty-classes {
          padding: 30px 15px;
          text-align: center;
          border: 1px dashed #cfd7e4;
          border-radius: 13px;
          color: var(--bs-muted);
          font-size: 13px;
        }

        .bs-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 15px;
        }

        .bs-button-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .bs-button {
          height: 42px;
          border-radius: 11px;
          border: 1px solid var(--bs-border);
          padding: 0 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
          background: #ffffff;
          color: var(--bs-text);
        }

        .bs-button:hover:not(:disabled) {
          border-color: #aebbd0;
        }

        .bs-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .bs-button.primary {
          background: var(--bs-primary);
          color: #ffffff;
          border-color: var(--bs-primary);
          min-width: 190px;
        }

        .bs-button.blue {
          background: var(--bs-blue);
          color: #ffffff;
          border-color: var(--bs-blue);
        }

        .bs-button.danger {
          color: var(--bs-red);
        }

        .bs-result-card {
          position: sticky;
          top: 20px;
        }

        .bs-result-empty {
          min-height: 220px;
          border: 1px dashed #d2dbe8;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 25px;
          background: #fbfcfe;
        }

        .bs-result-empty-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: #edf3ff;
          color: var(--bs-blue);
          display: grid;
          place-items: center;
          margin: 0 auto 12px;
        }

        .bs-result-empty strong {
          display: block;
          font-size: 15px;
          margin-bottom: 5px;
        }

        .bs-result-empty p {
          margin: 0;
          color: var(--bs-muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .bs-score {
          padding: 18px;
          border-radius: 15px;
          background: linear-gradient(
            135deg,
            #172033,
            #26344d
          );
          color: #ffffff;
          margin-bottom: 14px;
        }

        .bs-score-label {
          color: #b9c5d8;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .bs-score-values {
          display: flex;
          align-items: baseline;
          gap: 9px;
        }

        .bs-score-values strong {
          font-size: 34px;
          letter-spacing: -1px;
        }

        .bs-score-values span {
          color: #c7d1e1;
          font-size: 13px;
        }

        .bs-score-sub {
          margin-top: 7px;
          color: #c9d3e2;
          font-size: 11px;
        }

        .bs-status {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 13px;
          border-radius: 12px;
          margin-bottom: 13px;
          font-size: 13px;
          font-weight: 800;
        }

        .bs-status.safe {
          background: var(--bs-green-soft);
          color: #087653;
        }

        .bs-status.unsafe {
          background: var(--bs-red-soft);
          color: #b42333;
        }

        .bs-status.warning {
          background: var(--bs-yellow-soft);
          color: #99651b;
        }

        .bs-stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-bottom: 14px;
        }

        .bs-stat {
          padding: 12px;
          border: 1px solid #e1e6ee;
          border-radius: 12px;
          background: #ffffff;
        }

        .bs-stat span {
          display: block;
          color: var(--bs-muted);
          font-size: 10px;
          margin-bottom: 5px;
        }

        .bs-stat strong {
          display: block;
          font-size: 17px;
        }

        .bs-impact {
          padding: 14px;
          border-radius: 13px;
          background: #f7f9fc;
          margin-bottom: 14px;
        }

        .bs-impact-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
        }

        .bs-impact-row + .bs-impact-row {
          margin-top: 9px;
          padding-top: 9px;
          border-top: 1px solid #e4e8ef;
        }

        .bs-impact-row span {
          color: var(--bs-muted);
        }

        .bs-loss {
          color: var(--bs-red);
          font-weight: 800;
        }

        .bs-safe-text {
          color: var(--bs-green);
          font-weight: 800;
        }

        .bs-recommendation {
          padding: 14px;
          border-radius: 13px;
          border: 1px solid #dce5f5;
          background: #f5f8ff;
        }

        .bs-recommendation-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .bs-recommendation p {
          margin: 0;
          color: #56647a;
          font-size: 12px;
          line-height: 1.5;
        }

        .bs-how {
          display: flex;
          flex-direction: column;
          gap: 11px;
        }

        .bs-how-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .bs-how-number {
          width: 25px;
          height: 25px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: #eef3ff;
          color: var(--bs-blue);
          font-size: 11px;
          font-weight: 900;
          flex: 0 0 auto;
        }

        .bs-how-row strong {
          display: block;
          font-size: 12px;
          margin-bottom: 2px;
        }

        .bs-how-row span {
          color: var(--bs-muted);
          font-size: 11px;
          line-height: 1.4;
        }

        .bs-save {
          margin-top: 12px;
          width: 100%;
        }

        .bs-disclaimer {
          margin-top: 15px;
          color: #7b8798;
          font-size: 10px;
          line-height: 1.45;
          text-align: center;
        }

        @media (max-width: 1050px) {
          .bs-layout {
            grid-template-columns: 1fr;
          }

          .bs-result-card {
            position: static;
          }
        }

        @media (max-width: 800px) {
          .bunk-simulator-page {
            padding: 14px;
          }

          .bs-hero {
            flex-direction: column;
          }

          .bs-mode-grid,
          .bs-fields {
            grid-template-columns: 1fr;
          }

          .bs-class {
            grid-template-columns:
              24px
              1fr
              auto;
          }

          .bs-class-time,
          .bs-class-room {
            display: none;
          }

          .bs-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .bs-button.primary {
            width: 100%;
          }
        }
      `}</style>

      <div className="bs-container">
        {/* =====================================================
            HERO
        ====================================================== */}

        <div className="bs-hero">
          <div className="bs-hero-left">
            <div className="bs-hero-icon">
              <Sparkles size={25} />
            </div>

            <div>
              <h1>Smart Bunk Simulator</h1>

              <p>
                Know the cost before you bunk.
                Select a real timetable class
                and instantly see how your
                attendance will change.
              </p>
            </div>
          </div>

          <div className="bs-badge">
            <ShieldCheck size={15} />
            Attendance-aware planning
          </div>
        </div>

        <div className="bs-layout">
          {/* ===================================================
              LEFT
          ==================================================== */}

          <div className="bs-left">
            {/* SITUATION */}

            <section className="bs-card">
              <div className="bs-card-title">
                <div className="bs-card-title-icon">
                  <GraduationCap size={20} />
                </div>

                <div>
                  <h2>Choose your situation</h2>

                  <p>
                    Tell NoteDown how you want
                    to calculate your attendance.
                  </p>
                </div>
              </div>

              <div className="bs-mode-grid">
                <button
                  type="button"
                  className={`bs-mode ${
                    mode === "manual"
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setMode("manual");
                    setSelectedClasses([]);
                    setCalculated(false);
                  }}
                >
                  <div className="bs-radio" />

                  <div className="bs-mode-icon">
                    <GraduationCap size={19} />
                  </div>

                  <div>
                    <strong>
                      I joined NoteDown
                      mid-semester
                    </strong>

                    <span>
                      Enter the attendance
                      you already have.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`bs-mode ${
                    mode === "recorded"
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setMode("recorded");
                    setSelectedClasses([]);
                    setCalculated(false);
                  }}
                >
                  <div className="bs-radio" />

                  <div className="bs-mode-icon">
                    <CalendarDays size={19} />
                  </div>

                  <div>
                    <strong>
                      Use my NoteDown
                      attendance
                    </strong>

                    <span>
                      Use attendance already
                      recorded in NoteDown.
                    </span>
                  </div>
                </button>
              </div>
            </section>

            {/* ATTENDANCE INPUT */}

            <section className="bs-card">
              <div className="bs-card-title">
                <div className="bs-card-title-icon">
                  <Target size={20} />
                </div>

                <div>
                  <h2>
                    {mode === "manual"
                      ? "Enter your attendance details"
                      : "Your NoteDown attendance"}
                  </h2>

                  <p>
                    {mode === "manual"
                      ? "Use the attendance percentage and classes conducted so far."
                      : "These numbers come from your attendance records."}
                  </p>
                </div>
              </div>

              {mode === "manual" ? (
                <div className="bs-fields">
                  <div className="bs-field">
                    <label>
                      Current attendance
                    </label>

                    <div className="bs-input-wrap">
                      <input
                        className="bs-input bs-percent-input"
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={manualPercentage}
                        onChange={(event) =>
                          setManualPercentage(
                            Number(
                              event.target.value
                            )
                          )
                        }
                      />

                      <span className="bs-input-suffix">
                        %
                      </span>
                    </div>
                  </div>

                  <div className="bs-field">
                    <label>
                      Classes conducted
                    </label>

                    <input
                      className="bs-input"
                      type="number"
                      min={0}
                      step={1}
                      value={manualConducted}
                      onChange={(event) =>
                        setManualConducted(
                          Number(
                            event.target.value
                          )
                        )
                      }
                    />
                  </div>

                  <div className="bs-field">
                    <label>
                      Minimum target
                    </label>

                    <div className="bs-input-wrap">
                      <input
                        className="bs-input bs-percent-input"
                        type="number"
                        min={1}
                        max={100}
                        step={0.1}
                        value={target}
                        onChange={(event) =>
                          setTarget(
                            Number(
                              event.target.value
                            )
                          )
                        }
                      />

                      <span className="bs-input-suffix">
                        %
                      </span>
                    </div>
                  </div>

                  <div className="bs-field">
                    <label>
                      Look ahead
                    </label>

                    <select
                      className="bs-input"
                      value={lookAhead}
                      onChange={(event) =>
                        setLookAhead(
                          Number(
                            event.target.value
                          )
                        )
                      }
                    >
                      <option value={3}>
                        3 days
                      </option>

                      <option value={7}>
                        7 days
                      </option>

                      <option value={14}>
                        14 days
                      </option>

                      <option value={30}>
                        30 days
                      </option>
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bs-fields">
                    <div className="bs-field">
                      <label>
                        Current attendance
                      </label>

                      <div className="bs-input-wrap">
                        <input
                          className="bs-input bs-percent-input"
                          value={currentStats.percentage.toFixed(
                            1
                          )}
                          readOnly
                        />

                        <span className="bs-input-suffix">
                          %
                        </span>
                      </div>
                    </div>

                    <div className="bs-field">
                      <label>
                        Present classes
                      </label>

                      <input
                        className="bs-input"
                        value={currentStats.present}
                        readOnly
                      />
                    </div>

                    <div className="bs-field">
                      <label>
                        Classes conducted
                      </label>

                      <input
                        className="bs-input"
                        value={
                          currentStats.conducted
                        }
                        readOnly
                      />
                    </div>

                    <div className="bs-field">
                      <label>
                        Minimum target
                      </label>

                      <div className="bs-input-wrap">
                        <input
                          className="bs-input bs-percent-input"
                          type="number"
                          min={1}
                          max={100}
                          step={0.1}
                          value={target}
                          onChange={(event) =>
                            setTarget(
                              Number(
                                event.target.value
                              )
                            )
                          }
                        />

                        <span className="bs-input-suffix">
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bs-note">
                    <Info size={15} />

                    <span>
                      NoteDown currently has{" "}
                      <strong>
                        {currentStats.present}
                      </strong>{" "}
                      present out of{" "}
                      <strong>
                        {currentStats.conducted}
                      </strong>{" "}
                      conducted classes.
                    </span>
                  </div>
                </>
              )}

              {mode === "manual" && (
                <div className="bs-note">
                  <Info size={15} />

                  <span>
                    Example: if you already have
                    80% attendance after 25
                    classes, enter <strong>80</strong>{" "}
                    and <strong>25</strong>. NoteDown
                    will simulate future bunks from
                    that point.
                  </span>
                </div>
              )}
            </section>

            {/* TIMETABLE */}

            <section className="bs-card">
              <div className="bs-class-header">
                <div className="bs-class-header-left">
                  <div className="bs-card-title-icon">
                    <CalendarDays size={20} />
                  </div>

                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 17,
                      }}
                    >
                      Upcoming classes from
                      your timetable
                    </h2>

                    <p
                      style={{
                        margin:
                          "4px 0 0",
                        color:
                          "var(--bs-muted)",
                        fontSize: 12,
                      }}
                    >
                      Select the actual
                      timetable classes you
                      might bunk.
                    </p>
                  </div>
                </div>

                <div className="bs-count">
                  {upcomingClasses.length} upcoming
                </div>
              </div>

              {visibleClasses.length === 0 ? (
                <div className="bs-empty-classes">
                  <CalendarDays
                    size={28}
                    style={{
                      marginBottom: 8,
                    }}
                  />

                  <div>
                    No upcoming timetable
                    classes were found for this
                    period.
                  </div>

                  <div
                    style={{
                      marginTop: 5,
                      fontSize: 11,
                    }}
                  >
                    Check your timetable entries
                    and increase the look-ahead
                    period.
                  </div>
                </div>
              ) : (
                <div className="bs-class-list">
                  {visibleClasses.map(
                    (item) => {
                      const selected =
                        selectedClasses.includes(
                          item.key
                        );

                      return (
                        <div
                          key={item.key}
                          className={`bs-class ${
                            selected
                              ? "selected"
                              : ""
                          }`}
                          onClick={() =>
                            toggleClass(
                              item.key
                            )
                          }
                        >
                          <div className="bs-check">
                            {selected && (
                              <CheckCircle2
                                size={14}
                              />
                            )}
                          </div>

                          <div className="bs-class-main">
                            <strong>
                              {item.timetable
                                .subject_name ||
                                "Unnamed class"}
                            </strong>

                            <span>
                              {item.timetable
                                .subject_code ||
                                item.timetable
                                  .class_type ||
                                "Class"}
                            </span>
                          </div>

                          <div className="bs-class-time">
                            {item.timetable
                              .start_time}{" "}
                            –{" "}
                            {item.timetable
                              .end_time}
                          </div>

                          <div className="bs-class-room">
                            {item.timetable
                              .room ||
                              "Room not set"}
                          </div>

                          <div
                            className={`bs-class-date ${
                              item.isToday
                                ? "bs-today"
                                : ""
                            }`}
                          >
                            <strong>
                              {item.isToday
                                ? "Today"
                                : item.dayLabel}
                            </strong>

                            {item.dateLabel}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}

              {upcomingClasses.length >
                7 && (
                <div
                  style={{
                    marginTop: 10,
                    textAlign: "center",
                  }}
                >
                  <button
                    type="button"
                    className="bs-button"
                    onClick={() =>
                      setShowAllClasses(
                        (value) => !value
                      )
                    }
                  >
                    {showAllClasses
                      ? "Show fewer classes"
                      : `Show all ${upcomingClasses.length} classes`}
                  </button>
                </div>
              )}

              <div className="bs-actions">
                <div className="bs-button-row">
                  <button
                    type="button"
                    className="bs-button"
                    onClick={clearSelection}
                    disabled={
                      selectedClasses.length ===
                      0
                    }
                  >
                    <RotateCcw size={15} />
                    Clear
                  </button>

                  <button
                    type="button"
                    className="bs-button"
                    onClick={selectSafeBunks}
                    disabled={
                      upcomingClasses.length ===
                        0 ||
                      calculation.maximumSafeBunks ===
                        0
                    }
                  >
                    <ShieldCheck size={15} />
                    Select safe bunks
                  </button>
                </div>

                <button
                  type="button"
                  className="bs-button primary"
                  disabled={
                    selectedClasses.length ===
                    0
                  }
                  onClick={() =>
                    setCalculated(true)
                  }
                >
                  <Calculator size={16} />

                  Calculate bunk impact
                </button>
              </div>
            </section>
          </div>

          {/* ===================================================
              RIGHT
          ==================================================== */}

          <div className="bs-right">
            <section className="bs-card bs-result-card">
              <div className="bs-card-title">
                <div className="bs-card-title-icon">
                  <Calculator size={20} />
                </div>

                <div>
                  <h2>Bunk plan result</h2>

                  <p>
                    See exactly what happens to
                    your attendance before you
                    skip the class.
                  </p>
                </div>
              </div>

              {!calculated ||
              selectedClasses.length === 0 ? (
                <div className="bs-result-empty">
                  <div>
                    <div className="bs-result-empty-icon">
                      <Calculator size={24} />
                    </div>

                    <strong>
                      Select classes to simulate
                    </strong>

                    <p>
                      Choose one or more real
                      timetable classes and click
                      "Calculate bunk impact".
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bs-score">
                    <div className="bs-score-label">
                      If you bunk the selected
                      class
                      {selectedClasses.length >
                      1
                        ? "es"
                        : ""}
                    </div>

                    <div className="bs-score-values">
                      <strong>
                        {calculation.afterPercentage.toFixed(
                          1
                        )}
                        %
                      </strong>

                      <span>
                        from{" "}
                        {currentStats.percentage.toFixed(
                          1
                        )}
                        %
                      </span>
                    </div>

                    <div className="bs-score-sub">
                      {calculation.selectedCount}{" "}
                      class
                      {calculation.selectedCount >
                      1
                        ? "es"
                        : ""}{" "}
                      missed
                    </div>
                  </div>

                  <div
                    className={`bs-status ${
                      calculation.safe
                        ? "safe"
                        : "unsafe"
                    }`}
                  >
                    {calculation.safe ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <CircleAlert size={18} />
                    )}

                    <span>
                      {calculation.safe
                        ? "SAFE — you are still above your target"
                        : "BELOW TARGET — this bunk plan crosses your minimum"}
                    </span>
                  </div>

                  <div className="bs-stat-grid">
                    <div className="bs-stat">
                      <span>
                        Current attendance
                      </span>

                      <strong>
                        {currentStats.percentage.toFixed(
                          1
                        )}
                        %
                      </strong>
                    </div>

                    <div className="bs-stat">
                      <span>
                        After selected bunks
                      </span>

                      <strong>
                        {calculation.afterPercentage.toFixed(
                          1
                        )}
                        %
                      </strong>
                    </div>

                    <div className="bs-stat">
                      <span>
                        Classes bunked
                      </span>

                      <strong>
                        {calculation.selectedCount}
                      </strong>
                    </div>

                    <div className="bs-stat">
                      <span>
                        Safe bunks available
                      </span>

                      <strong>
                        {
                          calculation.maximumSafeBunks
                        }
                      </strong>
                    </div>
                  </div>

                  <div className="bs-impact">
                    <div className="bs-impact-row">
                      <span>
                        Attendance before
                      </span>

                      <strong>
                        {currentStats.present} /{" "}
                        {currentStats.conducted}
                      </strong>
                    </div>

                    <div className="bs-impact-row">
                      <span>
                        Attendance after
                      </span>

                      <strong>
                        {calculation.present} /{" "}
                        {
                          calculation.afterConducted
                        }
                      </strong>
                    </div>

                    <div className="bs-impact-row">
                      <span>
                        Percentage loss
                      </span>

                      <strong className="bs-loss">
                        -
                        {Math.max(
                          0,
                          calculation.loss
                        ).toFixed(1)}
                        %
                      </strong>
                    </div>

                    <div className="bs-impact-row">
                      <span>
                        Minimum target
                      </span>

                      <strong>
                        {target.toFixed(1)}%
                      </strong>
                    </div>
                  </div>

                  <div className="bs-recommendation">
                    <div className="bs-recommendation-title">
                      <TrendingDown
                        size={16}
                      />

                      What this means
                    </div>

                    <p>
                      {calculation.safe
                        ? calculation.remainingSafeBunks >
                          0
                          ? `After these ${calculation.selectedCount} bunk${
                              calculation.selectedCount >
                              1
                                ? "s"
                                : ""
                            }, you can still miss approximately ${calculation.remainingSafeBunks} more future class${
                              calculation.remainingSafeBunks >
                              1
                                ? "es"
                                : ""
                            } while staying at or above ${target.toFixed(
                              1
                            )}%.`
                          : `This selection brings you to ${calculation.afterPercentage.toFixed(
                              1
                            )}%, which is your last safe point at the ${target.toFixed(
                              1
                            )}% target.`
                        : `These selected bunks would take you below your ${target.toFixed(
                            1
                          )}% minimum. Consider attending at least one of the selected classes.`}
                    </p>
                  </div>
                </>
              )}

              <button
                type="button"
                className="bs-button bs-save"
                disabled={saving}
                onClick={() =>
                  void saveTarget()
                }
              >
                <Target size={15} />

                {saving
                  ? "Saving target..."
                  : "Save target as default"}
              </button>
            </section>

            {/* CURRENT SUMMARY */}

            <section className="bs-card">
              <div className="bs-card-title">
                <div className="bs-card-title-icon">
                  <ShieldCheck size={20} />
                </div>

                <div>
                  <h2>
                    Current attendance
                    summary
                  </h2>

                  <p>
                    Your starting point for the
                    simulation.
                  </p>
                </div>
              </div>

              <div className="bs-score">
                <div className="bs-score-label">
                  Current overall attendance
                </div>

                <div className="bs-score-values">
                  <strong>
                    {currentStats.percentage.toFixed(
                      1
                    )}
                    %
                  </strong>

                  <span>
                    target {target.toFixed(1)}%
                  </span>
                </div>

                <div className="bs-score-sub">
                  {currentStats.present} present /{" "}
                  {currentStats.conducted} conducted
                </div>
              </div>

              <div
                className={`bs-status ${
                  currentIsBelowTarget
                    ? "unsafe"
                    : "safe"
                }`}
              >
                {currentIsBelowTarget ? (
                  <TriangleAlert size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}

                <span>
                  {currentIsBelowTarget
                    ? "Current attendance is below your target"
                    : "Current attendance is above your target"}
                </span>
              </div>
            </section>

            {/* HOW IT WORKS */}

            <section className="bs-card">
              <div className="bs-card-title">
                <div className="bs-card-title-icon">
                  <Sparkles size={20} />
                </div>

                <div>
                  <h2>How it works</h2>

                  <p>
                    Simple four-step bunk
                    simulation.
                  </p>
                </div>
              </div>

              <div className="bs-how">
                <div className="bs-how-row">
                  <div className="bs-how-number">
                    1
                  </div>

                  <div>
                    <strong>
                      Enter your starting
                      attendance
                    </strong>

                    <span>
                      Example: 80% after 25
                      classes.
                    </span>
                  </div>
                </div>

                <div className="bs-how-row">
                  <div className="bs-how-number">
                    2
                  </div>

                  <div>
                    <strong>
                      Choose a real timetable
                      class
                    </strong>

                    <span>
                      NoteDown uses your actual
                      timetable.
                    </span>
                  </div>
                </div>

                <div className="bs-how-row">
                  <div className="bs-how-number">
                    3
                  </div>

                  <div>
                    <strong>
                      Calculate the impact
                    </strong>

                    <span>
                      See the exact projected
                      percentage.
                    </span>
                  </div>
                </div>

                <div className="bs-how-row">
                  <div className="bs-how-number">
                    4
                  </div>

                  <div>
                    <strong>
                      Decide before bunking
                    </strong>

                    <span>
                      Know whether the class
                      keeps you above your target.
                    </span>
                  </div>
                </div>
              </div>

              <div className="bs-disclaimer">
                The simulator assumes a missed
                class counts as an additional
                conducted class with no present
                attendance.
              </div>
            </section>

            <button
              type="button"
              className="bs-button"
              onClick={resetSimulator}
            >
              <RotateCcw size={15} />
              Reset simulator
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}