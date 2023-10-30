<script>
  import JsTable from "./JSTable.svelte";
  import { fetchData } from "./fetchData.js";

  let messager = "";
  let jsTH;
  let jsTB;
  let sql = "SELECT * FROM `pfollow`.`ebtd_events`";

  async function fetchDataOnClick() {
    const { ajsTH, ajsTB, error } = await fetchData(sql);

    if (error) {
      messager = error;
      console.log(messager);
    } else {
      jsTH = ajsTH;
      jsTB = ajsTB;
      messager = "";
    }
  }
</script>

<body>
  {messager}
  <textarea bind:value={sql} />
  <button on:click={fetchDataOnClick}>Fetch Data</button>
  <div style="height:75vh; overflow: auto;">
    {#if jsTH}
      <JsTable headerArray={jsTH} bodyArray={jsTB} />
    {/if}
  </div>
</body>

<style>
  textarea {
    width: 100%;
    height: 10vh;
  }
</style>
