//Just copy and paste this code to browsers console on http://orteil.dashnet.org/cookieclicker/ page and enjoy the game to be played for you.


var init = function () {
	var totalObjects = Game.ObjectsById.length;
	var totalUpgrades = Game.UpgradesById.length;
	var lastObjectToBuyId = null;

	function getObjectCostPerIncreasedCookiePerSecond(object)
	{
		return object.price / object.storedCps;
	}


	function decide()
	{
		var objectToBuyId = totalObjects - 1; //by default we buy the most efficient - last object. Unless we find a cheaper one to be more efficient
		for (var i=0; i < totalObjects - 1; i++) {
			var curObject = Game.ObjectsById[i];
			var nextObject = Game.ObjectsById[i+1];
			var curObjectCostPerIncreasedCookiePerSecond = getObjectCostPerIncreasedCookiePerSecond(curObject);
			var nextObjectCostPerIncreasedCookiePerSecond = getObjectCostPerIncreasedCookiePerSecond(nextObject);
			if (curObjectCostPerIncreasedCookiePerSecond <= nextObjectCostPerIncreasedCookiePerSecond) {
				objectToBuyId = i;
				break;
			}
		};	


		if (lastObjectToBuyId != objectToBuyId) {
			console.log("Object wiating to be purchased: " + Game.ObjectsById[objectToBuyId].name);
			lastObjectToBuyId = objectToBuyId;		
		}
		Game.ObjectsById[objectToBuyId].buy(1); //buy one ifpossible

		//always do all upgrades is available.
		if (Game.UpgradesInStore[0] && Game.UpgradesInStore[0].unlocked) {
			Game.UpgradesInStore[0].buy();		
		}


		//Autoclose notes with 10 seconds delay
		if (Game.Notes.length) {
			var firstNote = Game.Notes[Game.Notes.length -1];
			if (new Date().getTime() - firstNote.date > 10000) {
				Game.CloseNote(0);			
			}		
		}
	}
	setInterval(decide, 200);
};





init();

console.log('Bootstraping the game by cooking 100 cookies');

function collectFirstCookies()
{
	document.getElementById("bigCookie").click();
	if (Game.cookies == 100) {
		clearInterval(firstCookiesInterval);
	}
}
var firstCookiesInterval = setInterval(collectFirstCookies, 2); //apparently game can't handle faster than that.

