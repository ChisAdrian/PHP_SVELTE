export async function aslogout() {
    try {
        const response = await fetch("php_files/logout.php", {
            method: "POST", // You can use POST or GET, depending on your setup
        });

        if (response.ok) {
            console.log("User logged out");
            return true;
        } else {
            console.error("Logout failed");
            return false;
        }
    } catch (error) {
        console.error("Network error:", error);
        return false;
    }
}
