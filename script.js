const $ = (id) => document.getElementById(id);

$('addMission').addEventListener('click', () => {
    $('createMission').showModal()
})
$('createMission').addEventListener('click', () => {
    if (event.target === $('createMission')) {
        $('createMission').close();
    }
})