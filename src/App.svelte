<script>
	import { userProfile } from "./store";
	import Login from "./Login.svelte";
	import Home from "./Home.svelte";
	import { aslogout } from "./functions";
	import Query from "./Query.svelte";

	async function call_aslogout()
	{
		let logres = await aslogout();
		if(logres)
			$userProfile.isLoggedIn = false;
	}
	//Skip Login
	$userProfile.isLoggedIn = true;

</script>

<main>
	{#if $userProfile.isLoggedIn === false}
		<Login />
	{:else} 
		<ul id="menu">
			<li>
				<a
					href="/"
					on:click|preventDefault={() =>
						($userProfile.myPage = "Home")}>Home</a
				>
			</li>

			<li>
				<a
					href="/"
					on:click|preventDefault={() =>
						($userProfile.myPage = "Query")}>Query</a
				>
			</li>

			<li id="loggoff">
				<a href="/" on:click|preventDefault={call_aslogout}
					>{$userProfile.user}👈</a
				>
			</li>
		</ul>

		{#if $userProfile.myPage == "Home"}
			<Home />
		{/if}

		{#if $userProfile.myPage == "Query"}
		<Query />

		{/if}
	 {/if} 
</main>

<style>


	ul {
		list-style-type: none;
		margin: 0;
		padding: 0;
		overflow: hidden;
		background-color: #2196f3;
	}

	li {
		float: left;
	}

	li a {
		display: block;
		color: white;
		text-align: center;
		padding: 14px 16px;
		text-decoration: none;
	}

	li a:hover {
		background-color: #111;
	}

	#loggoff {
		float: inline-end;
	}
</style>
