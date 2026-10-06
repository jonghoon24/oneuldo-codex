import { useEffect, useRef, useState, type FormEvent } from 'react';
import { currentStreak, fullDateLabel, localDateKey, longestStreak, monthDays, monthLabel, shiftMonth } from './dates';
import { loadData, saveData, validateName, type Habit, type SavedData } from './storage';

type InitialState = { data: SavedData; error: string | null };

function getInitialState(): InitialState {
  try {
    return { data: loadData(), error: null };
  } catch {
    return {
      data: { version: 1, habits: [] },
      error: '저장된 데이터를 읽을 수 없습니다. 브라우저 저장소를 확인해 주세요. 기존 데이터는 변경되지 않았습니다.',
    };
  }
}

function App() {
  const [initial] = useState(getInitialState);
  const [data, setData] = useState(initial.data);
  const [fatalError, setFatalError] = useState<string | null>(initial.error);
  const [today, setToday] = useState(() => localDateKey(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => localDateKey(new Date()).slice(0, 7));
  const [selectedId, setSelectedId] = useState<string | null>(initial.data.habits[0]?.id ?? null);
  const [newName, setNewName] = useState('');
  const [newNameError, setNewNameError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const newNameRef = useRef<HTMLInputElement>(null);

  const selected = data.habits.find((habit) => habit.id === selectedId) ?? null;
  const pendingDelete = data.habits.find((habit) => habit.id === pendingDeleteId) ?? null;
  const todayMonth = today.slice(0, 7);

  useEffect(() => {
    function refreshToday() {
      const next = localDateKey(new Date());
      setToday((previous) => {
        if (previous !== next) {
          setVisibleMonth((current) => current === previous.slice(0, 7) ? next.slice(0, 7) : current);
        }
        return next;
      });
    }

    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(refreshToday, nextMidnight.getTime() - now.getTime() + 100);
    const interval = window.setInterval(refreshToday, 60_000);
    window.addEventListener('focus', refreshToday);
    document.addEventListener('visibilitychange', refreshToday);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshToday);
      document.removeEventListener('visibilitychange', refreshToday);
    };
  }, [today]);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (pendingDeleteId && dialog && !dialog.open) dialog.showModal();
    if (!pendingDeleteId && dialog?.open) dialog.close();
  }, [pendingDeleteId]);

  function commit(next: SavedData): boolean {
    if (fatalError) return false;
    try {
      saveData(next);
      setData(next);
      return true;
    } catch {
      setFatalError('변경 내용을 저장하지 못했습니다. 화면의 변경을 취소했습니다. 브라우저 저장소를 확인해 주세요.');
      return false;
    }
  }

  function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateName(newName, data.habits);
    if (error) {
      setNewNameError(error);
      return;
    }
    const habit: Habit = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      createdAt: today,
      completedDates: [],
    };
    if (commit({ version: 1, habits: [...data.habits, habit] })) {
      setSelectedId(habit.id);
      setVisibleMonth(todayMonth);
      setNewName('');
      setNewNameError(null);
      setEditing(false);
    }
  }

  function selectHabit(id: string) {
    setSelectedId(id);
    setVisibleMonth(todayMonth);
    setEditing(false);
    setEditError(null);
  }

  function toggleDate(habit: Habit, date: string) {
    if (fatalError || date < habit.createdAt || date > today) return;
    const completedDates = habit.completedDates.includes(date)
      ? habit.completedDates.filter((entry) => entry !== date)
      : [...habit.completedDates, date].sort();
    commit({
      version: 1,
      habits: data.habits.map((entry) => entry.id === habit.id ? { ...entry, completedDates } : entry),
    });
  }

  function beginEdit() {
    if (!selected) return;
    setEditedName(selected.name);
    setEditError(null);
    setEditing(true);
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const error = validateName(editedName, data.habits, selected.id);
    if (error) {
      setEditError(error);
      return;
    }
    if (commit({
      version: 1,
      habits: data.habits.map((habit) => habit.id === selected.id ? { ...habit, name: editedName.trim() } : habit),
    })) {
      setEditing(false);
      setEditError(null);
    }
  }

  function deleteHabit() {
    if (!pendingDelete) return;
    const index = data.habits.findIndex((habit) => habit.id === pendingDelete.id);
    const remaining = data.habits.filter((habit) => habit.id !== pendingDelete.id);
    const nextSelected = selectedId === pendingDelete.id
      ? remaining[index]?.id ?? remaining[index - 1]?.id ?? null
      : selectedId;
    if (commit({ version: 1, habits: remaining })) {
      setSelectedId(nextSelected);
      setVisibleMonth(todayMonth);
      setEditing(false);
    }
    setPendingDeleteId(null);
  }

  const calendarDays = selected ? monthDays(visibleMonth) : [];
  const streak = selected ? currentStreak(selected.completedDates, today) : 0;
  const bestStreak = selected ? longestStreak(selected.completedDates) : 0;
  const todayCompleted = selected?.completedDates.includes(today) ?? false;
  const previousMonth = shiftMonth(visibleMonth, -1);
  const nextMonth = shiftMonth(visibleMonth, 1);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">◒</span>
          <span>오늘도<span className="brand-period">.</span></span>
        </div>
        <div className="header-date">{fullDateLabel(today)} <span className="header-tagline">· 나의 작은 루틴</span></div>
      </header>

      <main className="main-content">
        <div className="intro">
          <div className="eyebrow"><span className="eyebrow-line" /> 하루를 쌓는 공간</div>
          <h1>작은 실천이<br /><em>일상이 되도록.</em></h1>
          <p>오늘의 한 칸을 채우고, 이어온 날들을 확인해 보세요.</p>
        </div>

        {fatalError && (
          <div className="fatal-alert" role="alert">
            <strong>저장소 오류</strong>
            <p>{fatalError}</p>
            <span>기록을 보호하기 위해 추가·수정·삭제·체크 기능을 중지했습니다.</span>
          </div>
        )}

        <div className="workspace">
          <section className="habits-panel card" aria-labelledby="habit-list-heading">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">나의 매일 습관</span>
                <h2 id="habit-list-heading">나의 습관 <span className="count">{data.habits.length}</span></h2>
              </div>
              <span className="heading-decoration" aria-hidden="true">✳</span>
            </div>

            <form className="add-form" onSubmit={addHabit} noValidate>
              <label htmlFor="new-habit-name">새 습관 추가</label>
              <div className="add-controls">
                <input
                  id="new-habit-name"
                  ref={newNameRef}
                  value={newName}
                  onChange={(event) => { setNewName(event.target.value); setNewNameError(null); }}
                  placeholder="예: 물 한 잔 마시기"
                  aria-invalid={Boolean(newNameError)}
                  aria-describedby={newNameError ? 'new-habit-error' : undefined}
                  disabled={Boolean(fatalError)}
                />
                <button type="submit" className="add-button" disabled={Boolean(fatalError)} aria-label="습관 추가">+</button>
              </div>
              {newNameError && <p className="field-error" id="new-habit-error" role="alert">{newNameError}</p>}
            </form>

            {data.habits.length === 0 ? (
              <div className="empty-habits">
                <div className="empty-illustration" aria-hidden="true"><span>✦</span><span>◌</span><span>✧</span></div>
                <h3>첫 습관을 시작해 볼까요?</h3>
                <p>매일 하고 싶은 일을 하나 적어 보세요.<br />기록은 오늘부터 시작됩니다.</p>
                <button type="button" className="text-action" onClick={() => newNameRef.current?.focus()} disabled={Boolean(fatalError)}>첫 습관 등록하기 <span aria-hidden="true">↗</span></button>
              </div>
            ) : (
              <ul className="habit-list">
                {data.habits.map((habit) => {
                  const checked = habit.completedDates.includes(today);
                  return (
                    <li key={habit.id} className={`habit-row ${selectedId === habit.id ? 'selected' : ''}`}>
                      <button
                        type="button"
                        className="habit-select"
                        onClick={() => selectHabit(habit.id)}
                        aria-current={selectedId === habit.id ? 'true' : undefined}
                        aria-label={`${habit.name} 선택, 현재 연속 ${currentStreak(habit.completedDates, today)}일`}
                      >
                        <span className="habit-name">{habit.name}</span>
                        <span className="habit-sub">연속 {currentStreak(habit.completedDates, today)}일</span>
                      </button>
                      <button
                        type="button"
                        className={`list-check ${checked ? 'checked' : ''}`}
                        onClick={() => toggleDate(habit, today)}
                        disabled={Boolean(fatalError) || today < habit.createdAt}
                        aria-label={`${habit.name}, 오늘 ${checked ? '완료 취소' : '완료하기'}`}
                        aria-pressed={checked}
                      ><span aria-hidden="true">{checked ? '✓' : '+'}</span></button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="storage-note"><span aria-hidden="true">⌂</span> 기록은 현재 브라우저에만 저장됩니다. 브라우저 데이터를 삭제하면 복구할 수 없어요.</div>
          </section>

          <section className="detail-panel card" aria-label="습관 상세">
            {selected ? (
              <>
                <div className="detail-top">
                  <div>
                    <span className="section-kicker">오늘의 기록</span>
                    {editing ? (
                      <form className="edit-form" onSubmit={saveEdit} noValidate>
                        <label htmlFor="edit-habit-name">습관 이름 변경</label>
                        <div className="edit-controls">
                          <input
                            id="edit-habit-name"
                            autoFocus
                            value={editedName}
                            onChange={(event) => { setEditedName(event.target.value); setEditError(null); }}
                            onKeyDown={(event) => { if (event.key === 'Escape') { setEditing(false); setEditError(null); } }}
                            aria-invalid={Boolean(editError)}
                            aria-describedby={editError ? 'edit-habit-error' : undefined}
                            disabled={Boolean(fatalError)}
                          />
                          <button type="submit" className="small-primary" disabled={Boolean(fatalError)}>저장</button>
                          <button type="button" className="small-plain" onClick={() => setEditing(false)}>취소</button>
                        </div>
                        {editError && <p className="field-error" id="edit-habit-error" role="alert">{editError}</p>}
                      </form>
                    ) : <h2>{selected.name}</h2>}
                    <p className="started-at">{fullDateLabel(selected.createdAt)}부터 시작</p>
                  </div>
                  <div className="detail-actions">
                    <button type="button" onClick={beginEdit} disabled={Boolean(fatalError) || editing}>이름 변경</button>
                    <button type="button" onClick={() => setPendingDeleteId(selected.id)} disabled={Boolean(fatalError)}>삭제</button>
                  </div>
                </div>

                <div className="progress-block">
                  <div className="streak-visual" aria-hidden="true">✳</div>
                  <div className="streak-stats">
                    <div className="streak-copy">
                      <span>현재 연속 기록</span>
                      <strong>{streak}<small>일</small></strong>
                      <p>{streak === 0 ? '오늘부터 한 걸음씩 시작해요.' : '꾸준히 이어온 날들이에요.'}</p>
                    </div>
                    <div className="streak-copy">
                      <span>최장 연속 기록</span>
                      <strong>{bestStreak}<small>일</small></strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`today-button ${todayCompleted ? 'done' : ''}`}
                    onClick={() => toggleDate(selected, today)}
                    disabled={Boolean(fatalError) || today < selected.createdAt}
                    aria-pressed={todayCompleted}
                  ><span aria-hidden="true">{todayCompleted ? '✓' : '+'}</span>{todayCompleted ? '오늘 완료 · 취소하기' : '오늘 완료하기'}</button>
                </div>

                <div className="calendar-section">
                  <div className="calendar-header">
                    <div>
                      <span className="section-kicker">날짜별 기록</span>
                      <h3>실천 달력</h3>
                    </div>
                    <div className="month-navigation">
                      <button type="button" onClick={() => setVisibleMonth(previousMonth)} disabled={previousMonth < selected.createdAt.slice(0, 7)} aria-label="이전 달">‹</button>
                      <span aria-live="polite">{monthLabel(visibleMonth)}</span>
                      <button type="button" onClick={() => setVisibleMonth(nextMonth)} disabled={nextMonth > todayMonth} aria-label="다음 달">›</button>
                    </div>
                  </div>
                  <div className="calendar-grid" role="group" aria-label={`${monthLabel(visibleMonth)} 실천 기록`}>
                    {['월', '화', '수', '목', '금', '토', '일'].map((day) => <span className="weekday" key={day}>{day}</span>)}
                    {calendarDays.map((date, index) => {
                      if (!date) return <span key={`blank-${index}`} className="calendar-blank" aria-hidden="true" />;
                      const available = date >= selected.createdAt && date <= today;
                      const checked = available && selected.completedDates.includes(date);
                      const isToday = date === today;
                      const state = !available ? '기록 불가' : checked ? '완료' : '미완료';
                      const shortState = !available ? '불가' : checked ? '완료' : '안 함';
                      return (
                        <button
                          type="button"
                          key={date}
                          className={`calendar-day ${checked ? 'completed' : ''} ${isToday ? 'today' : ''}`}
                          onClick={() => toggleDate(selected, date)}
                          disabled={!available || Boolean(fatalError)}
                          aria-pressed={available ? checked : undefined}
                          aria-label={`${fullDateLabel(date)}${isToday ? ', 오늘' : ''}, ${state}${available ? ', 체크 전환' : ''}`}
                        >
                          <span className="day-number">{Number(date.slice(-2))}</span>
                          <span className="day-state"><span aria-hidden="true">{checked ? '✓' : '·'}</span> {shortState}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="calendar-hint"><span aria-hidden="true">✳</span> 등록일부터 오늘까지 자유롭게 기록을 바꿀 수 있어요.</p>
                </div>
              </>
            ) : (
              <div className="empty-detail">
                <span className="empty-detail-art" aria-hidden="true">◌</span>
                <h2>어떤 습관을 쌓아 볼까요?</h2>
                <p>왼쪽에서 습관을 등록하면<br />오늘의 기록과 달력이 나타납니다.</p>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="site-footer"><span>오늘도, 어제보다 한 걸음.</span><span>나의 하루를 기록하는 공간</span></footer>

      <dialog ref={deleteDialogRef} className="delete-dialog" onClose={() => setPendingDeleteId(null)} aria-labelledby="delete-title" aria-describedby="delete-description">
        <div className="dialog-icon" aria-hidden="true">!</div>
        <h2 id="delete-title">습관을 삭제할까요?</h2>
        <p id="delete-description"><strong>{pendingDelete?.name}</strong> 습관과 모든 체크 기록이 영구 삭제됩니다. 삭제 후에는 복구할 수 없습니다.</p>
        <div className="dialog-actions">
          <button type="button" onClick={() => setPendingDeleteId(null)}>취소</button>
          <button type="button" className="delete-confirm" onClick={deleteHabit}>삭제하기</button>
        </div>
      </dialog>
    </div>
  );
}

export default App;
