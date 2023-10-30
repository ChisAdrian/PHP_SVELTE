<script>
    import { onMount } from "svelte";
    import { userProfile } from "./store";
    import JsTable from "./JSTable.svelte";

    import { fetchData } from "./fetchData.js"; 

    import Editplanmanual from "./Editplanmanual.svelte";

    let messager = "";

    let jsTH = ["Please Wait", ""];
    let jsTB = [["Please", "Wait"]];

    let query = "SELECT * FROM `pfollow`.`ebtd_events` LIMIT 10;";
  onMount(async () => {
    const { ajsTH, ajsTB, error } = await fetchData(query);

    if (error) {
      messager = error;
      console.log(messager)
    } else {
        jsTH = ajsTH;
        jsTB =  ajsTB;

      // You can use jsTH and jsTB here
    }
  });

  let showModal = false;



</script>

<body>
  <Editplanmanual  bind:showModal>
  
  </Editplanmanual>

    <div style="height: 88vh; overflow: auto;">
      <button on:click={() => (showModal = true)}> show modal </button>
        {messager}
        <JsTable headerArray={jsTH} bodyArray={jsTB} />
    </div>
</body>

<style>
</style>
