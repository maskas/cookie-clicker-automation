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
			console.log("An item to be purchased next: " + Game.ObjectsById[objectToBuyId].name);
			lastObjectToBuyId = objectToBuyId;		
		}
		Game.ObjectsById[objectToBuyId].buy(1); //buy one ifpossible

		//always do all available upgrades.
		for (var i=0; i < Game.UpgradesInStore.length; i++) {
			if (Game.UpgradesInStore[i].name == "One mind") { //avoid this upgrade. It may be harmful
				continue;
			}
			Game.UpgradesInStore[i].buy();
		}

		//auto close notes with 10 seconds delay
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

vat bigCookie = document.getElementById("bigCookie");

function collectFirstCookies()
{
	bigCookie.click();
	if (Game.cookies >= 100) {
		clearInterval(firstCookiesInterval);
	}
}
var firstCookiesInterval = setInterval(collectFirstCookies, 2); //apparently the game can't handle faster than that.

