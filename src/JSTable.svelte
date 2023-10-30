<script>
    export let headerArray;
    export let bodyArray;
  
    let sortASC = true;
    let active_column = 'inactive';
  
    function toggleSort(col) {
      sortASC = active_column === col ? !sortASC : true;
      active_column = col;
  
      let rows = document.querySelectorAll('.data-row');
      rows = Array.from(rows);
  
      rows.sort((a, b) => {
        const aVal = a.childNodes[col].textContent || a.childNodes[col].innerText;
        const bVal = b.childNodes[col].textContent || b.childNodes[col].innerText;
  
        return sortASC ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
  
      const tbody = document.querySelector('#id-tbody');
      tbody.innerHTML = '';
      rows.forEach((row) => tbody.appendChild(row));
    }
  
    function filterTable(colnr) {
      let input = document.getElementById(colnr).value.toUpperCase();
  
      let rows = document.querySelectorAll('.data-row');
      rows = Array.from(rows);
  
      rows.forEach((row) => {
        const tableData = row.childNodes[colnr];
        const txtValue = tableData.textContent || tableData.innerText;
  
        if (txtValue.toUpperCase().includes(input)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }

    function displaySearch( colid){

      let visibelStatus =  document.getElementById(colid).style.display ;
      if(visibelStatus =='none'){
          document.getElementById(colid).style.display = 'block';
         // elem.target.classList.add('active-column')
      }

      else   document.getElementById(colid).style.display = 'none';
    }

  </script>
  
  <table>
    <thead class="sticky">
      <tr>
        {#each headerArray as thh, i}
          <th>
        
              {thh}
              <button style="font-size: small;" on:click={() => toggleSort(i)}
                 class:active_class={i === active_column} class:active-column={i === active_column}>
                ↕ 
              </button>
              <button style="font-size: small;" 
                on:click={() => displaySearch(i)}>&#128269; </button>
             <input
                id={i}
                class="input-header" style="display: none;"
                on:input={() => filterTable(i)}
                type="text"
              />
       
          </th>
        {/each}
      </tr>
    </thead>
    <tbody id="id-tbody">
      {#each bodyArray as trr}
        <tr class="data-row">
          {#each trr as tcell}
            <td>{tcell}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
  


<style>
    .active-column {
    background-color: #007bff; /* Change this to your desired background color */
    color: #fff; /* Change this to your desired text color */
    font-size: small;
  }

    .input-header {
      display: none;
        width: 90%;
        height: 1.5rem;
        margin: auto;
       
    }

    thead {
        position: sticky;
        top: 0;
        background-color: white;
    }

    tbody tr,
    td {
        border-collapse: collapse;
        border: 1px solid black;
    }

    td {
        padding: 5px;
    }

    table,
    tbody {
        border-collapse: collapse;
        border: 1px solid black;
    }
</style>
