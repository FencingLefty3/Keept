const $ = (id) => document.getElementById(id);
const dlg  = $('createMission')
const form = $('missionForm')
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
    document.querySelectorAll('.fullDiv').forEach(p => {
        const on = p.id.toLowerCase() === t
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
    const m = {
        id: crypto.randomUUID(),
        type,
        icon: (f.get('icon') || '').trim() || '',
        title: (f.get('title') || '').trim(),
        description: (f.get('description') || '').trim(),
    }
    if (type === 'goal') {
        m.target = Number(f.get('target')) || 1
        m.unit = (f.get('unit') || '').trim()
        m.progress = 0
    } else {
        m.times = Number(f.get('times')) || 1
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
    if (now < m.times) cur = stepBack(m.period, cur)  // this period can still be completed
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
    const stop = () => { clearTimeout(t); b.classList.remove('holding')}
    b.addEventListener('pointerdown', () => {
        b.classList.add('holding')
        t = setTimeout(() => { stop(); navigator.vibrate?.(30); onDone()})
    })
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
    b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDone() }
    })
    return b
}

function card(m) {
    const el = h('div', 'mission')
    const head = h('div', 'mHead')
    head.append(h('span', 'mIcon', m.icon), h('strong', 'mTitle', m.title))
    el.append(head)
    if(m.description) el.append(h('p', 'mDesc', m.description))

    let pct, label, done
    if (m.type === 'goal') {
        pct = Math.min(100, (m.progress / navigation.target) * 100)
    label = `${m.progress} / ${m.target} ${m.unit}`.trim()
    done = m.progress >= m.target
    el.append(h('p', 'mStat', label))
    } else {
        const s = streakInfo(m)
        pct = Math.min(100, (s.now / m.times) * 100)
        done = s.done
        el.append(h('p', 'mStat', `${s.now} of ${m.times} this ${m.period}, streak ${s.streak}`))
    }

    const bar = h('div', 'bar')
    const fill = h('i')
    fill.style.width = pct + '%'
    bar.append(fill)
    el.append(bar)

    el.classList.toggle('done', done)
    if (!done) {
        el.append(holdButton(m.type === 'goal' ? 'Hold to add 1' : 'Hold to confirm', () => {
            if (m.type === 'goal') m.progress++;
            else m.log.push(ymd(new Date()));
            save()
            render()
        }))
    }
    return el
}

function render() {
    const box = $('missionContainer')
    box.replaceChildren(...missions.map(card))
}

setType('goal')
render()