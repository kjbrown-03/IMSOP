import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import {
  Search, Plus, Loader2, Pencil, Power, PowerOff, X, Check,
  ShieldCheck, MapPin, Building2, Languages, BadgeCheck, CalendarClock,
} from 'lucide-react'

const EMPTY_FORM = {
  fullName: '', email: '', phone: '',
  specialite: '', pays: '', etablissement: '', langues: '', bio: '',
}

export default function AdminUserManager({ role }) {
  const { t } = useTranslation()
  const isSpecialiste = role === 'SPECIALISTE'
  const ns = isSpecialiste ? 'specialistes' : 'coordinateurs'

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [error, setError] = useState(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [newCredential, setNewCredential] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/admin/users', { params: { role, q: query || undefined } })
      setUsers(data)
    } catch (err) {
      setError(err.response?.data?.message || t('admin.users.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  function onSearchSubmit(e) {
    e.preventDefault()
    load()
  }

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setNewCredential(null)
    setFormOpen(true)
  }

  function openEdit(user) {
    setEditingId(user.id)
    setForm({
      fullName: user.fullName || '',
      email: user.email || '',
      phone: user.phone || '',
      specialite: user.specialiste?.specialite || '',
      pays: user.specialiste?.pays || '',
      etablissement: user.specialiste?.etablissement || '',
      langues: user.specialiste?.langues || '',
      bio: user.specialiste?.bio || '',
    })
    setFormError(null)
    setNewCredential(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setNewCredential(null)
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      if (editingId) {
        await api.patch(`/admin/users/${editingId}`, form)
        closeForm()
      } else {
        const { data } = await api.post('/admin/users', { role, ...form })
        setNewCredential({ email: data.user.email, password: data.temporaryPassword })
      }
      await load()
    } catch (err) {
      setFormError(err.response?.data?.message || t('admin.users.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(user) {
    setBusyId(user.id)
    try {
      await api.patch(`/admin/users/${user.id}/active`, { active: !user.active })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 animate-fade-in-up">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
            {isSpecialiste ? <BadgeCheck className="w-7 h-7 text-primary-600 dark:text-primary-400" /> : <ShieldCheck className="w-7 h-7 text-primary-600 dark:text-primary-400" />}
            {t(`admin.${ns}.title`)}
          </h2>
          <p className="text-slate-500 dark:text-slate-400">{t(`admin.${ns}.subtitle`)}</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold px-5 py-3 rounded-xl hover:bg-primary-600 dark:hover:bg-primary-500 dark:hover:text-white transition-colors shadow-md shadow-slate-900/10 flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> {t(`admin.${ns}.newButton`)}
        </button>
      </div>

      <form onSubmit={onSearchSubmit} className="relative mb-6 max-w-md">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('admin.users.searchPlaceholder')}
          className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        />
      </form>

      {formOpen && (
        <div className="glass-card rounded-3xl p-6 mb-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-slate-900">
              {editingId ? t('admin.users.editTitle') : t(`admin.${ns}.createTitle`)}
            </h3>
            <button onClick={closeForm} className="text-slate-400 hover:text-slate-700 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {newCredential ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold">
                <Check className="w-5 h-5" /> {t('admin.users.createdTitle')}
              </div>
              <p className="text-sm text-emerald-800">{t('admin.users.createdHint')}</p>
              <div className="bg-white rounded-xl border border-emerald-200 p-4 font-mono text-sm text-slate-800 flex flex-col gap-1">
                <span>{t('common.email')}: {newCredential.email}</span>
                <span>{t('admin.users.temporaryPassword')}: {newCredential.password}</span>
              </div>
              <button
                onClick={closeForm}
                className="self-start bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium rounded-xl px-4 py-3">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  required
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder={t('admin.users.fullNamePlaceholder')}
                  className="h-11 px-4 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
                <input
                  required
                  type="email"
                  disabled={!!editingId}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder={t('common.email')}
                  className="h-11 px-4 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-slate-50 dark:disabled:bg-neutral-900 disabled:text-slate-400 dark:disabled:text-slate-500"
                />
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder={t('admin.users.phonePlaceholder')}
                  className="h-11 px-4 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
                {isSpecialiste && (
                  <input
                    value={form.specialite}
                    onChange={(e) => setForm((f) => ({ ...f, specialite: e.target.value }))}
                    placeholder={t('admin.specialistes.specialitePlaceholder')}
                    className="h-11 px-4 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  />
                )}
                {isSpecialiste && (
                  <>
                    <input
                      value={form.pays}
                      onChange={(e) => setForm((f) => ({ ...f, pays: e.target.value }))}
                      placeholder={t('admin.specialistes.paysPlaceholder')}
                      className="h-11 px-4 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    />
                    <input
                      value={form.etablissement}
                      onChange={(e) => setForm((f) => ({ ...f, etablissement: e.target.value }))}
                      placeholder={t('admin.specialistes.etablissementPlaceholder')}
                      className="h-11 px-4 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    />
                    <input
                      value={form.langues}
                      onChange={(e) => setForm((f) => ({ ...f, langues: e.target.value }))}
                      placeholder={t('admin.specialistes.languesPlaceholder')}
                      className="h-11 px-4 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors md:col-span-2"
                    />
                    <textarea
                      value={form.bio}
                      onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                      placeholder={t('admin.specialistes.bioPlaceholder')}
                      rows={2}
                      className="px-4 py-3 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors md:col-span-2"
                    />
                  </>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="text-sm font-semibold text-slate-500 px-4 py-2.5 rounded-xl hover:bg-slate-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-60"
                >
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium rounded-2xl px-5 py-4 mb-4">{error}</div>}

      {loading && (
        <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('common.loading')}
        </div>
      )}

      {!loading && users.length === 0 && (
        <div className="glass-card rounded-3xl p-10 text-center text-slate-500 animate-fade-in-up">
          {t('admin.users.empty')}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {users.map((u, idx) => (
          <div
            key={u.id}
            className="glass-card rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up"
            style={{ animationDelay: `${idx * 0.04}s` }}
          >
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-lg font-bold text-slate-900">{u.fullName}</h4>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    u.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {u.active ? t('admin.users.active') : t('admin.users.inactive')}
                </span>
                {isSpecialiste && u.specialiste?.verificationStatus === 'VALIDE' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" /> {t('admin.specialistes.verified')}
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-500">{u.email}{u.phone ? ` • ${u.phone}` : ''}</div>
              {isSpecialiste && u.specialiste && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 mt-1">
                  {u.specialiste.specialite && <span className="flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5 text-slate-400" /> {u.specialiste.specialite}</span>}
                  {u.specialiste.pays && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {u.specialiste.pays}</span>}
                  {u.specialiste.etablissement && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-slate-400" /> {u.specialiste.etablissement}</span>}
                  {u.specialiste.langues && <span className="flex items-center gap-1"><Languages className="w-3.5 h-3.5 text-slate-400" /> {u.specialiste.langues}</span>}
                </div>
              )}
              <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                <CalendarClock className="w-3.5 h-3.5" /> {t('admin.users.createdOn')} {new Date(u.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => openEdit(u)}
                className="bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" /> {t('common.edit')}
              </button>
              <button
                onClick={() => toggleActive(u)}
                disabled={busyId === u.id}
                className={`text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-60 ${
                  u.active
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {u.active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                {u.active ? t('admin.users.deactivate') : t('admin.users.reactivate')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
