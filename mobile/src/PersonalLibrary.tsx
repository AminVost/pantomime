import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { CatalogPackDTO } from "@/types/game";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { loadBundledCatalogPack } from "./offline/catalog-client";
import { addPersonalCategory, addPersonalWords, deletePersonalItem, editPersonalWord, hasSavedActiveGame, mergePersonalCatalog, normalizeTitle, readPersonalCatalog, type PersonalCatalog } from "./offline/personal-catalog";

export function PersonalLibrary({ onClose }: { onClose: () => void }) {
  const [base, setBase] = useState<CatalogPackDTO | null>(null);
  const [personal, setPersonal] = useState<PersonalCatalog | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [text, setText] = useState("");
  const [points, setPoints] = useState<2 | 4 | 6>(2);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<{ kind: "word" | "category"; id: number } | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const requestClose = () => text.trim() || categoryName.trim() ? setConfirmExit(true) : onClose();
  useLayoutEffect(() => {
    const handleBack = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (deleting) setDeleting(null);
      else if (confirmExit) setConfirmExit(false);
      else requestClose();
    };
    window.addEventListener("pantomime:native-back", handleBack, true);
    return () => window.removeEventListener("pantomime:native-back", handleBack, true);
  });
  const locked = hasSavedActiveGame();
  useEffect(() => {
    let live = true;
    void loadBundledCatalogPack().then(pack => {
      if (!live) return;
      setBase(pack);
      const data = readPersonalCatalog();
      setPersonal(data);
      setCategoryId(data.categories[0]?.id ?? pack.categories[0]?.id ?? null);
    }).catch(e => { if (live) setError(e instanceof Error ? e.message : "بارگذاری انجام نشد."); });
    return () => { live = false; };
  }, []);
  const pack = useMemo(() => base && personal ? mergePersonalCatalog(base, personal) : null, [base, personal]);
  const foundWords = useMemo(() => personal?.words.filter(word => normalizeTitle(word.title).includes(normalizeTitle(search))) ?? [], [personal, search]);
  const perform = (action: () => string) => {
    setError("");
    setMessage("");
    try { setMessage(action()); setPersonal(readPersonalCatalog()); }
    catch (e) { setError(e instanceof Error ? e.message : "ذخیره انجام نشد."); }
  };
  const addCategory = () => base && perform(() => {
    const category = addPersonalCategory(base, categoryName);
    setCategoryId(category.id);
    setCategoryName("");
    return "موضوع ساخته شد؛ حالا کلمه‌هاش رو اضافه کن.";
  });
  const saveWords = () => base && categoryId !== null && perform(() => {
    if (editingId !== null) {
      editPersonalWord(base, editingId, text, points);
      setEditingId(null);
      setText("");
      return "تغییرات ذخیره شد.";
    }
    const count = addPersonalWords(base, categoryId, text, points);
    setText("");
    return `${count} کلمه اضافه شد. موضوع رو از تنظیمات بازی انتخاب کن.`;
  });
  return <div className="screen library-screen">
    <div className="topbar"><div className="brand-mini"><img className="brand-icon" src="/brand/adazi-mascot-96.webp" srcSet="/brand/adazi-mascot-96.webp 96w, /brand/adazi-mascot-192.webp 192w" sizes="36px" width={36} height={36} alt="" /><span>کلمات من</span></div><button className="icon-btn" aria-label="بازگشت به خانه" onClick={requestClose}>×</button></div>
    <div className="library-body">
      <h1 className="title-lg">بازی با کلمه‌های شما</h1>
      <p className="copy hint-copy">موضوع بساز یا به موضوع‌های موجود کلمه اضافه کن. هر کلمه در یک خط.</p>
      <p className="library-storage-note">کلمات روی همین گوشی ذخیره می‌شن؛ با حذف برنامه یا پاک کردن داده‌ها، حذف می‌شن.</p>
      {locked && <p className="library-storage-note">بازی نیمه‌تمام داری؛ افزودن کلمه آزاده. موضوع تازه رو در بازی بعدی انتخاب کن. ویرایش و حذف بعد از پایان بازی باز می‌شه.</p>}
      {!pack && !error && <p role="status">در حال آماده‌سازی…</p>}
      {pack && <>
        <div className="library-section card">
          <h2 className="title-md">موضوع تازه</h2>
          <div className="library-inline"><input aria-label="نام موضوع جدید" placeholder="مثلاً خاطره‌های ما" maxLength={40} value={categoryName} onChange={e => setCategoryName(e.target.value)} /><Button wide={false} tone="secondary" onClick={addCategory} disabled={!categoryName.trim()}>افزودن موضوع</Button></div>
        </div>
        <div className="library-section card">
          <h2 className="title-md">{editingId !== null ? "ویرایش کلمه" : "کلمه‌های تازه"}</h2>
          <label className="library-field">موضوع<select aria-label="موضوع کلمات" value={categoryId ?? ""} disabled={editingId !== null} onChange={e => setCategoryId(Number(e.target.value))}>{pack.categories.map(c => <option key={c.id} value={c.id}>{c.name}{c.id < 0 ? " · شخصی" : ""}</option>)}</select></label>
          <fieldset className="library-points"><legend>امتیاز کلمه‌ها</legend>{([2, 4, 6] as const).map(p => <label key={p} className={points === p ? "selected" : ""}><input type="radio" name="word-points" value={p} checked={points === p} onChange={() => setPoints(p)} />{p} · {p === 2 ? "آسان" : p === 4 ? "متوسط" : "سخت"}</label>)}</fieldset>
          <label className="library-field">{editingId !== null ? "کلمه" : "کلمه‌ها، هر کدام در یک خط"}<textarea aria-label="متن کلمات" rows={4} maxLength={12000} placeholder={"دوچرخه‌سواری\nباز کردن هدیه"} value={text} onChange={e => setText(e.target.value)} /></label>
          {editingId !== null && <Button tone="ghost" onClick={() => { setEditingId(null); setText(""); }}>لغو ویرایش</Button>}
        </div>
        <div className="library-section">
          <h2 className="title-md">موضوع‌های شخصی ({personal?.categories.length ?? 0})</h2>
          {personal?.categories.map(c => <div className="library-item" key={c.id}><span>{c.name}<small>{personal.words.filter(w => w.categoryId === c.id).length} کلمه</small></span><button className="text-btn danger-text" disabled={locked} onClick={() => setDeleting({ kind: "category", id: c.id })} aria-label={`حذف موضوع ${c.name}`}>حذف</button></div>)}
          <h2 className="title-md">کلمه‌های شخصی ({personal?.words.length ?? 0})</h2>
          <input className="library-search" aria-label="جستجوی کلمات شخصی" placeholder="جستجو در کلمات من" value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(50); }} />
          <div className="library-word-list">{foundWords.slice(0, visibleCount).map(w => <div className="library-item" key={w.id}><span>{w.title}<small>{pack.categories.find(c => c.id === w.categoryId)?.name} · {w.points} امتیاز</small></span><div><button className="text-btn" disabled={locked} onClick={() => { setEditingId(w.id); setCategoryId(w.categoryId); setText(w.title); setPoints(w.points); document.querySelector('.library-field')?.scrollIntoView({ block: "start", behavior: "smooth" }); }} aria-label={`ویرایش ${w.title}`}>ویرایش</button><button className="text-btn danger-text" disabled={locked} onClick={() => setDeleting({ kind: "word", id: w.id })} aria-label={`حذف ${w.title}`}>حذف</button></div></div>)}</div>
          {foundWords.length > visibleCount && <Button tone="ghost" onClick={() => setVisibleCount(count => count + 50)}>نمایش بیشتر ({foundWords.length - visibleCount})</Button>}
          {!!personal?.words.length && !foundWords.length && <p className="hint-copy">کلمه‌ای پیدا نشد.</p>}
          {!personal?.words.length && <p className="hint-copy">هنوز کلمه‌ای اضافه نکردی.</p>}
        </div>
      </>}
    </div>
    <div className="screen-footer library-footer">
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <div className="setup-footer"><Button onClick={saveWords} disabled={!pack || !text.trim()}>{editingId !== null ? "ذخیره تغییرات" : "ذخیره کلمه‌ها"}</Button><Button tone="ghost" wide={false} onClick={requestClose}>خانه</Button></div>
    </div>
    {deleting && <Modal title={deleting.kind === "category" ? "موضوع و کلمه‌هاش حذف بشن؟" : "این کلمه حذف بشه؟"} onClose={() => setDeleting(null)}><p>این کار قابل برگشت نیست.</p><Button tone="danger" onClick={() => perform(() => { deletePersonalItem(deleting.kind, deleting.id); if (categoryId === deleting.id) setCategoryId(base?.categories[0]?.id ?? null); setDeleting(null); setEditingId(null); setText(""); return "حذف شد."; })}>حذف</Button></Modal>}
    {confirmExit && <Modal title="بدون ذخیره برگردیم؟" onClose={() => setConfirmExit(false)}><p>متنی که هنوز ذخیره نکردی کنار گذاشته می‌شه.</p><Button tone="danger" onClick={onClose}>خروج بدون ذخیره</Button></Modal>}
  </div>;
}
