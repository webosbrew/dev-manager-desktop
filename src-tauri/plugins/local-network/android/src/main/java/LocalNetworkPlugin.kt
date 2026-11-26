package org.webosbrew.devman.localnetwork

import android.app.Activity
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.RouteInfo
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.net.InetAddress

@InvokeArg
class FindNetworkArgs {
    /** A numeric IP address. */
    lateinit var address: String
}

@TauriPlugin
class LocalNetworkPlugin(activity: Activity) : Plugin(activity) {
    private val connectivity = activity.getSystemService(ConnectivityManager::class.java)

    /**
     * Find the network to bind a socket for an address to.
     *
     * Resolves `handle` to the [Network.getNetworkHandle] of the network with
     * the most specific route to the address, as a string. Default routes do
     * not count. Resolves no `handle` when no network has such a route, or when
     * the active network is a VPN that routes the address. The socket then
     * follows the default network.
     */
    @Command
    fun findNetwork(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(FindNetworkArgs::class.java)
            // A numeric address parses without a DNS lookup.
            val network = findNetwork(InetAddress.getByName(args.address))
            val result = JSObject()
            if (network != null) {
                result.put("handle", network.networkHandle.toString())
            }
            invoke.resolve(result)
        } catch (ex: Exception) {
            invoke.reject(ex.message)
        }
    }

    private fun findNetwork(target: InetAddress): Network? {
        val active = connectivity.activeNetwork
        if (active != null && isVpn(active) && localRoute(active, target) != null) {
            return null
        }
        @Suppress("DEPRECATION")
        return connectivity.allNetworks
            .filterNot(::isVpn)
            .mapNotNull { network -> localRoute(network, target)?.let { network to it } }
            // On a tie, prefer a network that is not mobile data.
            .maxWithOrNull(compareBy({ it.second.destination.prefixLength }, { !isCellular(it.first) }))
            ?.first
    }

    private fun localRoute(network: Network, target: InetAddress): RouteInfo? =
        connectivity.getLinkProperties(network)?.routes
            ?.filter { !it.isDefaultRoute && it.matches(target) }
            ?.maxByOrNull { it.destination.prefixLength }

    private fun isVpn(network: Network) = hasTransport(network, NetworkCapabilities.TRANSPORT_VPN)

    private fun isCellular(network: Network) =
        hasTransport(network, NetworkCapabilities.TRANSPORT_CELLULAR)

    private fun hasTransport(network: Network, transport: Int) =
        connectivity.getNetworkCapabilities(network)?.hasTransport(transport) == true
}
