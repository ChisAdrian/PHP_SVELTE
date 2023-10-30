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

        if (response.ok) {
            const jsonString = await response.text();

            try {
                const jsonData = JSON.parse(jsonString);
                if (jsonData.stat) {
                    const ajsTH = jsonData.Header;
                    const ajsTB = jsonData.Body;
                    return { ajsTH, ajsTB };
                } else {
                    const messager = "jsonData.stat:" + jsonData.Header;
                    return { error: messager };
                }
            } catch (error) {
                const messager = "FAILED JSON:" + jsonString;
                return { error: messager };
            }
        } else {
            return { error: jsonString };
        }
    } catch (error) {
        return { error };
    }
}
