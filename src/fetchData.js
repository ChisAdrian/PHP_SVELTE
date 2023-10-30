// fetchData.js

export async function fetchData(query) {
    const data = { query };
    try {
        const response = await fetch("php_files/read_query.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        const jsonString = await response.text();

        if (response.ok) {
            try {
                const jsonData = JSON.parse(jsonString);
                if (jsonData.stat) {
                    const ajsTH = jsonData.Header;
                    const ajsTB = jsonData.Body;
                    return { ajsTH, ajsTB };
                } else {

                    return { error: "jsonData.stat:" + "!!" + jsonData.Header };
                }
            }
            catch (error) {
                return { error: "JSON.parse!" + "!!" + jsonString };
            }
        }
        else {
            return { error: 'response.ok!' + "!!" + jsonString };

        }
    }
    catch (error) {
        return { error: 'try await!' + "?" + jsonString };
    }
}
