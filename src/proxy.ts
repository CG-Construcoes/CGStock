import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { jwtKey } from '@/lib/auth-secret'

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === 'development'
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self' data:;
    connect-src 'self' blob:;
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    ${process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests;' : ''}
  `
  return csp.replace(/\s{2,}/g, ' ').trim()
}

function withSecurityHeaders(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  }
  return response
}

function unauthorizedApi() {
  return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
}

export default async function proxy(request: NextRequest) {
  const session = request.cookies.get('session')?.value
  const { pathname } = request.nextUrl

  const isApi = pathname.startsWith('/api/')
  const isLoginPage = pathname.startsWith('/login')
  const isChangePasswordPage = pathname.startsWith('/change-password')

  if (!session) {
    if (isApi) return unauthorizedApi()
    if (!isLoginPage && !isChangePasswordPage) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return withSecurityHeaders(request)
  }

  try {
    const { payload } = await jwtVerify(session, jwtKey, { algorithms: ["HS256"] })

    if (isApi) {
      if (payload.mustChangePassword) {
        return NextResponse.json(
          { error: 'É obrigatório definir uma nova senha para continuar.' },
          { status: 403 }
        )
      }
      return NextResponse.next()
    }

    const mustChangePassword = payload.mustChangePassword as boolean

    if (mustChangePassword && !isChangePasswordPage) {
      return NextResponse.redirect(new URL('/change-password', request.url))
    }

    if (!mustChangePassword && isChangePasswordPage) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (isLoginPage) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    return withSecurityHeaders(request)
  } catch {
    // Invalid session
    if (isApi) {
      const response = unauthorizedApi()
      response.cookies.delete('session')
      return response
    }
    if (!isLoginPage) {
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('session')
      return response
    }
    return withSecurityHeaders(request)
  }
}

export const config = {
  matcher: [
    // Executa em rotas de página e API; ignora assets estáticos e arquivos públicos (sw.js, manifest, ícones...)
    '/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)',
  ],
}
