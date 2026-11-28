const $ = (id) => document.getElementById(id);
const dlg  = $('createMission')
const form = $('missionForm')
const editDlg = $('editMission')
const editForm = $('editForm')
const tabs = document.querySelectorAll('.tabs [role=tab]')
const KEY  = 'keept.missions'

//------------------ storage ------------------//
let missions = load()
function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || [] }
    catch { return [] }
}
function save() {
    try { localStorage.setItem(KEY, JSON.stringify(missions)) } catch {}
}
//------------------ dialog -------------------//
function setType(t) {
    dlg.dataset.type = t
    tabs.forEach(b => b.setAttribute('aria-selected', b.dataset.type === t))
    dlg.querySelectorAll('.fullDiv').forEach(p => {
        const on = p.dataset.type === t
        p.querySelectorAll('input, select').forEach(el => el.disabled = !on)
    })
}
tabs.forEach(b => b.addEventListener('click', () => setType(b.dataset.type)))
//event listiners
$('addMission').addEventListener('click', () => {
    setType(dlg.dataset.type || 'goal')
    dlg.showModal()
})
$('cancelMission').addEventListener('click', () => dlg.close())

dlg.addEventListener('click', (e) => {
    if (e.target !== dlg) return
    const r = dlg.getBoundingClientRect()
    const inside = e.clientX >= r.left && e.clientX <= r.right &&
                   e.clientY >= r.top  && e.clientY <= r.bottom
    if (!inside) dlg.close()
})
dlg.addEventListener('close', () => form.reset())
//form
form.addEventListener('submit', (e) => {
    e.preventDefault()
    const f = new FormData(form)
    const type = dlg.dataset.type
    const title = f.get('title').trim()
    const iconChar = title[0]
    const m = {
        id: crypto.randomUUID(),
        type,
        icon: (f.get('icon') || '').trim() ||  `${iconChar}`,
        title: (f.get('title') || '').trim(),
        description: (f.get('description') || '').trim(),
    }
    if (type === 'goal') {
        m.target = Number(f.get('target')) || 1
        m.unit = (f.get('unit') || '').trim()
        m.deatline = (f.get('date') || '').trim()
        m.progress = 0
    } else {
        m.times = Number(f.get('times')) || 1
        m.unit = (f.get('unit') || '').trim()
        m.period = f.get('period')
        m.log = []
    }
    missions.push(m)
    save()
    render()
    dlg.close()
})
                     
//------------------ streaks ------------------//

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
}

function periodStart(period, d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (period === 'week')  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))  // Monday
    if (period === 'month') x.setDate(1)
    return x
}
function stepBack(period, start) {
    const x = new Date(start)
    if (period === 'day') x.setDate(x.getDate() - 1)
    else if (period === 'week') x.setDate(x.getDate() - 7)
    else x.setMonth(x.getMonth() - 1)
    return x
}
function streakInfo(m) {
    const counts = {}
    m.log.forEach(s => {
        const k = ymd(periodStart(m.period, parse(s)))
        counts[k] = (counts[k] || 0) + 1
    })
    let cur = periodStart(m.period, new Date())
    const now = counts[ymd(cur)] || 0
    if (now < m.times) cur = stepBack(m.period, cur) 
    let streak = 0
    while ((counts[ymd(cur)] || 0) >= m.times) {
        streak++
        cur = stepBack(m.period, cur)
    }
    return { now, streak, done: now >= m.times }
}

//------------------ rendering ----------------//

function h(tag, css, txt) {
    const el = document.createElement(tag)
    if (css) el.className = css
    if (txt !== undefined) el.textContent = txt
    return el
}

function holdButton(label, onDone) {
    const b = h('button', 'hold', label)
    let t
    const stop = () => { clearTimeout(t); b.classList.remove('holding') }
    b.addEventListener('pointerdown', () => {
        b.classList.add('holding')
        t = setTimeout(() => { stop(); navigator.vibrate?.(30); onDone() }, 600)
    })
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
        b.addEventListener(ev, stop)
    }
    b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDone() }
    })
    return b
}

function card(m) {
    const el = h('div', 'mission')
    const body = h('div', 'mBody')
    el.append(h('span', 'mIcon', m.icon), body)
    body.append(h('strong', 'mTitle', m.title))

    const details = h('li', 'mDetails')
    if (m.description) {
        details.append(h('p', 'mDesc', m.description))
        details.append(h('p', 'mSeparator', '•'))
    }

    let pct, status, done
    if (m.type === 'goal') {
        pct = Math.min(100, (m.progress / m.target) * 100)
        status = `${m.progress} / ${m.target} ${m.unit}`.trim()
        done = m.progress >= m.target
    } else {
        const s = streakInfo(m)
        pct = Math.min(100, (s.now / m.times) * 100)
        done = s.done
        const periodLabel = m.period === 'day' ? 'today' : `this ${m.period}`
        status = `${s.now} of ${m.times} ${periodLabel} • streak ${s.streak}`
    }
    details.append(h('p', 'mStat', status))
    body.append(details)

    const bar = h('div', 'bar')
    const fill = h('i')
    fill.style.width = pct + '%'
    bar.append(fill)
    body.append(bar)

    el.classList.toggle('done', done)

    el.addEventListener('click', () => openEditModal(m))

    return el
}

function render() {
    const box = $('missionContainer')
    box.replaceChildren(...missions.map(card))
}
//---------------- Edit ------------//

function openEditModal(m) {
    editDlg.dataset.id = m.id
    editDlg.dataset.type = m.type

    let activeDiv
    editDlg.querySelectorAll('.fullDiv').forEach(div => {
        const isMatch = div.dataset.type === m.type
        div.querySelectorAll('input, select').forEach(el => el.disabled = !isMatch)
        if (isMatch) activeDiv = div
    })

    if (!activeDiv) throw new Error(`No edit form panel for mission type "${m.type}"`)

    activeDiv.querySelector('[name="title"]').value = m.title
    activeDiv.querySelector('[name="icon"]').value = m.icon
    activeDiv.querySelector('[name="description"]').value = m.description || ''

    if (m.type === 'goal') {
        activeDiv.querySelector('[name="target"]').value = m.target
        activeDiv.querySelector('[name="unit"]').value = m.unit || ''
        activeDiv.querySelector('[name="date"]').value = m.deatline || ''
    } else {
        activeDiv.querySelector('[name="times"]').value = m.times
        activeDiv.querySelector('[name="unit"]').value = m.unit || ''
        activeDiv.querySelector('[name="period"]').value = m.period
    }

    editDlg.showModal()
}

editForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const m = missions.find(mission => mission.id === editDlg.dataset.id)
    if (!m) throw new Error(`No mission found with id "${editDlg.dataset.id}"`)

    const activeDiv = editDlg.querySelector(`.fullDiv[data-type="${m.type}"]`)
    if (!activeDiv) throw new Error(`No edit form panel for mission type "${m.type}"`)

    const value = (name) => activeDiv.querySelector(`[name="${name}"]`).value
    m.title = value('title').trim()
    m.icon = value('icon').trim() || m.title[0] || ''
    m.description = value('description').trim()

    if (m.type === 'goal') {
        m.target = Number(value('target')) || 1
        m.unit = value('unit').trim()
        m.deatline = value('date')
    } else {
        m.times = Number(value('times')) || 1
        m.unit = value('unit').trim()
        m.period = value('period')
    }

    save()
    render()
    editDlg.close()
})

$('cancelEdit').addEventListener('click', () => editDlg.close())
editDlg.addEventListener('click', (e) => {
    if (e.target !== editDlg) return
    const r = editDlg.getBoundingClientRect()
    const inside = e.clientX >= r.left && e.clientX <= r.right &&
                   e.clientY >= r.top  && e.clientY <= r.bottom
    if (!inside) editDlg.close()
})
editDlg.addEventListener('close', () => editForm.reset())

setType('goal')
render()