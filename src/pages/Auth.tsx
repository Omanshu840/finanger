import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/providers/AuthProvider'
import { signInSchema, signUpSchema, magicLinkSchema, type SignInInput, type SignUpInput, type MagicLinkInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { toast } from 'sonner'
import { Mail, Lock, Loader2, WifiOff } from 'lucide-react'
import { isOnline } from '@/lib/utils'

export default function Auth() {
  const navigate = useNavigate()
  const { signIn, signUp, signInWithMagicLink } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const online = isOnline()

  // Sign In Form
  const signInForm = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  // Sign Up Form
  const signUpForm = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: ''
    }
  })

  // Magic Link Form
  const magicLinkForm = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: {
      email: ''
    }
  })

  const onSignIn = async (values: SignInInput) => {
    if (!online) {
      toast.error('You are offline', {
        description: 'Please check your internet connection'
      })
      return
    }

    setIsLoading(true)
    const { error } = await signIn(values.email, values.password)
    
    if (error) {
      toast.error('Sign in failed', {
        description: error.message || 'Invalid email or password'
      })
    } else {
      navigate('/dashboard')
    }
    
    setIsLoading(false)
  }

  const onSignUp = async (values: SignUpInput) => {
    if (!online) {
      toast.error('You are offline', {
        description: 'Please check your internet connection'
      })
      return
    }

    setIsLoading(true)
    const { error } = await signUp(values.email, values.password)
    
    if (error) {
      toast.error('Sign up failed', {
        description: error.message
      })
    } else {
      toast.success('Account created!', {
        description: 'Please check your email to verify your account',
        duration: 6000
      })
      signUpForm.reset()
    }
    
    setIsLoading(false)
  }

  const onMagicLink = async (values: MagicLinkInput) => {
    if (!online) {
      toast.error('You are offline', {
        description: 'Please check your internet connection'
      })
      return
    }

    if (cooldownSeconds > 0) {
      toast.error('Please wait', {
        description: `You can request another link in ${cooldownSeconds} seconds`
      })
      return
    }

    setIsLoading(true)
    const { error } = await signInWithMagicLink(values.email)
    
    if (error) {
      toast.error('Failed to send magic link', {
        description: error.message
      })
    } else {
      setMagicLinkSent(true)
      toast.success('Magic link sent!', {
        description: 'Check your email for the sign-in link',
        duration: 6000
      })
      
      // Start cooldown
      setCooldownSeconds(60)
      const interval = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    
    setIsLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen w-full px-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center">
            Finance Tracker
          </CardTitle>
          <CardDescription className="text-center">
            Sign in to manage your expenses and investments
          </CardDescription>
          
          {!online && (
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mt-4">
              <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                You are currently offline
              </p>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
              <TabsTrigger value="magic">Magic Link</TabsTrigger>
            </TabsList>

            {/* Sign In Tab */}
            <TabsContent value="signin">
              <Form {...signInForm}>
                <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-4 mt-4">
                  <FormField
                    control={signInForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="email"
                              placeholder="you@example.com"
                              className="pl-10"
                              disabled={isLoading || !online}
                              autoComplete="email"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signInForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="password"
                              placeholder="••••••••"
                              className="pl-10"
                              disabled={isLoading || !online}
                              autoComplete="current-password"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || !online}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            {/* Sign Up Tab */}
            <TabsContent value="signup">
              <Form {...signUpForm}>
                <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-4 mt-4">
                  <FormField
                    control={signUpForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="email"
                              placeholder="you@example.com"
                              className="pl-10"
                              disabled={isLoading || !online}
                              autoComplete="email"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="password"
                              placeholder="••••••••"
                              className="pl-10"
                              disabled={isLoading || !online}
                              autoComplete="new-password"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="password"
                              placeholder="••••••••"
                              className="pl-10"
                              disabled={isLoading || !online}
                              autoComplete="new-password"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || !online}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            {/* Magic Link Tab */}
            <TabsContent value="magic">
              <Form {...magicLinkForm}>
                <form onSubmit={magicLinkForm.handleSubmit(onMagicLink)} className="space-y-4 mt-4">
                  <FormField
                    control={magicLinkForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="email"
                              placeholder="you@example.com"
                              className="pl-10"
                              disabled={isLoading || !online}
                              autoComplete="email"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {magicLinkSent && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <p className="text-sm text-green-800 dark:text-green-200">
                        Check your email for the magic link to sign in
                      </p>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || !online || cooldownSeconds > 0}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {cooldownSeconds > 0 
                      ? `Resend in ${cooldownSeconds}s` 
                      : isLoading 
                        ? 'Sending...' 
                        : 'Send Magic Link'
                    }
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    We'll send you a one-time link to sign in instantly
                  </p>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}