<script>
    export let tbl_data_cols;
    export let tbl_data_rows;
  
    let sortBy = { col: 0, ascending: true };
  
    function isNumber(value) {
      return !isNaN(parseFloat(value)) && isFinite(value);
    }
  
    function sort(column) {
      sortBy.ascending = sortBy.col === column ? !sortBy.ascending : true;
      sortBy.col = column;
  
      tbl_data_rows = tbl_data_rows.sort((a, b) => {
        const sortModifier = sortBy.ascending ? 1 : -1;
        const aValue = a[column];
        const bValue = b[column];
  
        return isNumber(aValue)
          ? sortModifier * (aValue - bValue)
          : aValue.localeCompare(bValue) * sortModifier;
      });
    }
  </script>
  
  <div>
    <table>
      <thead>
        <tr>
          {#each tbl_data_cols as th, i}
            <th on:click={() => sort(i)} class:selected={sortBy.col === i} class:asc={sortBy.col === i && sortBy.ascending} class:desc={sortBy.col === i && !sortBy.ascending}>
              {th}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each tbl_data_rows as row, i}
          <tr key={i}>
            {#each row as c}
              <td>{c}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  
  <style>
    .selected {
      font-weight: bold;
      
    }
  
    .asc::after {
      content: " \2191";
      font-size: xx-large;
    }
  
    .desc::after {
      content: " \2193";
      font-size: xx-large;
    }
  
    /* Add other styles as needed */

    thead{
        position: sticky;
        top: 0;
        background-color: black;
        color: white;
    }

    table 
    {
        width: 90%;
        margin: auto;
        height: 85vh;
        background-color: aliceblue;
       
    }

    table, th, td {
  border: 1px solid black;
  border-collapse: collapse;
}

    td {
        text-align: center;
    }
  </style>
  