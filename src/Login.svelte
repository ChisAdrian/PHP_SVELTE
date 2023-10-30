<script>
    let username = "";
    let password = "";
    let messager = "";
    import { userProfile } from "./store";
    async function handleSubmit() {
        document.getElementById("wait").style.display = "block";
        const data = { username, password };
        try {
            const response = await fetch("php_files/Login.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                const jsonString = await response.text();
                try {
                    const jsonData = JSON.parse(jsonString); // jsonString is the JSON data you want to parse
                    // You can work with the parsed JSON data here
                    if (jsonData.stat) {
                        $userProfile.isLoggedIn = jsonData.stat;
                        $userProfile.role = jsonData.role;
                        $userProfile.user = jsonData.user;
                        if($userProfile.myPage == null)
                             $userProfile.myPage = 'Home'

                    } else messager = jsonData.message;
                } catch (
                    error // !const jsonData = JSON.parse(jsonString);
                ) {
                    // Handle the parsing error here
                    messager = jsonString;
                }
            } // !response.ok
            else {
                messager = jsonString;
            }
        } catch (
            error //!  const response = await fetch("Login.php",
        ) {
            messager = error;
        } finally {
            document.getElementById("wait").style.display = "none";
        }
    }
</script>

<div>
    <!-- login form goes here -->
    <center>
        <div class="login">
            <h3>Login</h3>
            <span style="background-color: azure;">{messager}</span>

            <form on:submit|preventDefault={handleSubmit}>
                <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    id="username"
                    bind:value={username}
                    required
                />

                <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    id="password"
                    bind:value={password}
                    required
                />

                <button type="submit" value="Login">Login </button>
            </form>

            <span id="wait"> Please wait</span>
        </div>
    </center>
</div>

<style>
    * {
        width: 90%;
        max-width: 750px;
        margin: auto;
    }

    #wait {
        display: none;
        background-color: bisque;
    }

    .login {
        margin-top: 25%;
        background-color: #3c6c99;
        border-radius: 5px;
        padding: 10px;
    }

    form {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    input,
    button {
        margin-top: 5px;
        margin-bottom: 10px;
        padding: 10px;
        border: none;
        border-radius: 5px;
    }

    button {
        background-color: rgb(138, 190, 136);
        color: aliceblue;
        font-weight: bolder;
    }
</style>
