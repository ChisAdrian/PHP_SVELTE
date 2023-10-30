<script>
    export let showModal; // boolean

    let dialog; // HTMLDialogElement

    $: if (dialog && showModal) dialog.showModal();

    let linesArray = ["LINE1", "LINE2", "LINE3"];

    let refsArray = ["REF1", "REF2", "REF3"];

    let answer = "";

    let rowsCount = 5;

    function savePlan() {
        alert("savePlan()");
    }

    function removeRow() {
        rowsCount = rowsCount - 1;
    }

    function addRow() {
        rowsCount++;
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<dialog
    bind:this={dialog}
    on:close={() => (showModal = false)}
    on:click|self={() => dialog.close()}
>
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div on:click|stopPropagation>
        <div class="flexi">
        <button  on:click={savePlan}>Save</button>
        <button class="addRow" on:click={addRow}> + </button>
        <button class="removeRow" on:click={removeRow}> - </button>
        <button class="close-dial"  on:click={() => dialog.close()}>X</button>
    </div>
        <hr />
        <table>
            <thead>
                <tr>
                    <th>Linie</th>
                    <th>Referinta </th>
                    <th>Cantit </th>
                    <th>deliv_nr </th>
                    <th>deliv_date</th>
                </tr>
            </thead>
            <tbody>
                {#each { length: rowsCount } as _, i}
                    <tr>
                        <td>
                            <select on:change={() => (answer = "")}>
                                {#each linesArray as question}
                                    <option value={question}>
                                        {question}
                                    </option>
                                {/each}
                            </select>
                        </td>
                        <td>
                            <select on:change={() => (answer = "")}>
                                {#each refsArray as question}
                                    <option value={question}>
                                        {question}
                                    </option>
                                {/each}
                            </select>
                        </td>
                        <td>
                            <input type="number" min="1" max="100000" />
                        </td>
                        <td>
                            <input type="text" />
                        </td>
                        <td>
                            <input type="datetime-local" name="deliv-date" />
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</dialog>

<style>

    table{
        margin: auto;
     
    }

    .flexi{
        display: flex;
        flex-direction: row;
        justify-content:space-between;
    }

    dialog *{
        font-size: large;
    }

    dialog {
        border-radius: 0.2em;
        border: none;
        padding: 0;
        width: 99%;
    }
    dialog::backdrop {
        background: rgba(0, 0, 0, 0.3);
    }
    dialog > div {
        padding: 1em;
       
    }
    dialog[open] {
        animation: zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes zoom {
        from {
            transform: scale(0.95);
        }
        to {
            transform: scale(1);
        }
    }
    dialog[open]::backdrop {
        animation: fade 0.2s ease-out;
    }
    @keyframes fade {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    button {
        display: block;
        font-size: larger;
        padding-left: 10px;
        padding-right: 10px;
    }

    .addRow {
        background-color: chocolate;

    }

    .removeRow {
        background-color: rgb(204, 30, 210);
  
    }

    .close-dial {
        background-color: rgb(210, 30, 45);
    }
</style>
