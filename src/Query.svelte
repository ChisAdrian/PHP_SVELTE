<script>
  import JsTable from "./JSTable.svelte";
  import { fetchData } from "./fetchData.js";

  let messager = "";
  let jsTH;
  let jsTB;
  let sql = "SELECT * FROM some table";

  async function fetchDataOnClick() {
    jsTH = ["MSG"];
    jsTB = [["Plese wait"]];
    messager = "";
    const { ajsTH, ajsTB, error } = await fetchData(sql);
    if (error) {
      jsTH = ["MSG"];
      jsTB = [[error.split("!!")[0]]];
      messager = error;
    } else {
      jsTH = ajsTH;
      jsTB = ajsTB;
    }
  }
</script>

<body>
  <textarea bind:value={sql} />
  <button on:click={fetchDataOnClick}>Fetch Data</button>
  <div style="height:75vh; overflow: auto;">
    {#if jsTH}
      <JsTable headerArray={jsTH} bodyArray={jsTB} />
    {/if}

    <div class="messager-disp">
      {#if { messager }}
        {@html messager}
      {/if}
    </div>
  </div>
</body>

<style>
  textarea {
    width: 100%;
    height: 10vh;
  }

  .messager-disp {
    background-color: crimson;
  }
</style>
