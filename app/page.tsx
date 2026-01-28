"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Copy, Shield, ArrowLeft, Key, RefreshCw, AlertTriangle, QrCode, Plus, Users, User, PenLine, Upload } from "lucide-react"
import Link from "next/link"
import { createSecureShare } from "./actions/share"
import { SecureCrypto } from "../lib/crypto"
import { SecurityTips } from "@/components/security-tips"
import { InlineTip } from "@/components/inline-tip"
import { PasswordInput } from "@/components/password-input"
import { QrCodeModal } from "@/components/qr-code-modal"
import { Header } from "@/components/header"

interface Recipient {
  id: string
  name: string
  expirationTime: string
  maxViews: number
  requirePassword: boolean
  password: string
}

interface GeneratedLink {
  recipientId: string
  recipientName: string
  shareId: string
  shareLink: string
  expirationTime: string
  maxViews: number
  requirePassword: boolean
  imgUrl?:string
  fileUrl?:string
}

export default function CreatePage() {
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    linkType: "standard", // "standard" or "shorter"
    multiRecipient: false,
  })
  
  const IMGBB_API_KEY = '6e1ff9f433cba8d29826a9d043d11562'
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  
  const [localImage, setLocalImage] = useState<File | null>(null);
  const [localImagesPreview, setLocalImagesPreview] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);

    // faqat image
    const imagesOnly = selectedFiles.filter(file =>
      file.type.startsWith("image/")
    );

    setFiles(imagesOnly);
    fileRef.current!.value = "";
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1MB limit
    if (file.size > 1 * 1024 * 1024) {
      setError("Image must be less than 1MB");
      e.target.value = "";
      return;
    }

    // Eski preview tozalanadi
    if (localImagesPreview) {
      URL.revokeObjectURL(localImagesPreview);
    }

    setError("");
    setLocalImage(file);
    setLocalImagesPreview(URL.createObjectURL(file));

    // MUHIM: input reset
    e.target.value = "";
  };


 const removeImage = () => {
    if (localImagesPreview) {
      URL.revokeObjectURL(localImagesPreview);
    }

    setLocalImage(null);
    setLocalImagesPreview("");
  };

  const uploadImages = async (images?:any): Promise<string | undefined> => {
    if (!images) return;

    const getBase64 = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const base64 = reader.result?.toString().split(",")[1];
          base64 ? resolve(base64) : reject("Base64 error");
        };
        reader.onerror = reject;
      });

    const base64 = await getBase64(images);

    const formData = new FormData();
    formData.append("image", base64);

    const res = await fetch(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await res.json();
    if (!data.success) {
      throw new Error("ImgBB yuklashda xatolik");
    }

    return data.data.url;
  } ;



 




  // Single recipient settings (when multiRecipient is false)
  const [singleRecipientSettings, setSingleRecipientSettings] = useState({
    expirationTime: "1h",
    maxViews: 1,
    requirePassword: false,
    password: "",
  })
  
  // Multi-recipient state
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [newRecipientName, setNewRecipientName] = useState("")
  
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedLink[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [qrModalLink, setQrModalLink] = useState("")
  const [qrModalTitle, setQrModalTitle] = useState("")
  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState("")
  const [tags, setTags] = useState(["NEW"])
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const addRecipient = () => {
    if (!newRecipientName.trim()) return
    if (recipients.length >= 3) return
    
    const newRecipient: Recipient = {
      id: crypto.randomUUID(),
      name: newRecipientName.trim(),
      expirationTime: "1h",
      maxViews: 1,
      requirePassword: false,
      password: "",
    }
    
    setRecipients([...recipients, newRecipient])
    setNewRecipientName("")
  }

  const removeRecipient = (id: string) => {
    setRecipients(recipients.filter(r => r.id !== id))
  }

  const updateRecipient = (id: string, updates: Partial<Recipient>) => {
    setRecipients(recipients.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  const generateSecurePassword = (recipientId?: string) => {
    if (!isClient) return
    const password = SecureCrypto.generateSecurePassword()
    
    if (recipientId) {
      updateRecipient(recipientId, { password })
    } else {
      setSingleRecipientSettings({ ...singleRecipientSettings, password })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isClient) return
    if(!localImage){
      setError("Please enter an logo to share")
      return
    }

    
    // Validate form data
    if (!formData.content.trim()) {
      setError("Please enter some content to share")
      return
    }

    if (formData.multiRecipient && recipients.length === 0) {
      setError("Please add at least one recipient for multi-recipient sharing")
      return
    }

    // Validate passwords for recipients that require them
    const recipientsToProcess = formData.multiRecipient ? recipients : [{
      id: 'single',
      name: 'there',
      ...singleRecipientSettings
    }]

    for (const recipient of recipientsToProcess) {
      if (recipient.requirePassword && !recipient.password.trim()) {
        setError(`Please enter a password for ${recipient.name} or disable password protection`)
        return
      }
    }

    setIsLoading(true)
    setError("")

    try {
      const imageUrl = await uploadImages(localImage);
      const fileUrl = await uploadImages(files[0]);
      // Generate encryption key client-side (same key for all recipients)
      const encryptionKey = await SecureCrypto.generateKey()
      const keyString = await SecureCrypto.exportKey(encryptionKey)

      // Encrypt content client-side (once for all recipients)
      const { encrypted, iv } = await SecureCrypto.encrypt(formData.content, encryptionKey)

      const links: GeneratedLink[] = []

      // Create separate shares for each recipient
      for (const recipient of recipientsToProcess) {
        const result = await createSecureShare({
          title: formData.title,
          encryptedContent: encrypted,
          iv: iv,
          expirationTime: recipient.expirationTime,
          maxViews: recipient.maxViews,
          requirePassword: recipient.requirePassword,
          password: recipient.password,
          linkType: formData.linkType,
          imgUrl:imageUrl,
          fileUrl:fileUrl
        })

        if (result.success && result.id) {
          const shareId = result.id
          
          // Immediate verification
          setTimeout(async () => {
            try {
              const { testShareExists } = await import("./actions/share")
              await testShareExists(shareId)
            } catch (error) {
              console.error("Share verification failed:", error)
            }
          }, 1000)

          // Include encryption key in URL fragment (same key for all)
          const shareUrl = `${window.location.origin}/view/${shareId}#${keyString}`
          
          links.push({
            recipientId: recipient.id,
            recipientName: recipient.name,
            shareId,
            shareLink: shareUrl,
            expirationTime: recipient.expirationTime,
            maxViews: recipient.maxViews,
            requirePassword: recipient.requirePassword,
            imgUrl:imageUrl,
            fileUrl:fileUrl
          })
        } else {
          setError(result.error || `Failed to create secure share for ${recipient.name}`)
          return
        }
      }

      setGeneratedLinks(links)
      removeImage()
      setFiles([])
    } catch (error) {
      console.error("Failed to create secure share:", error)
      setError("Failed to create secure share. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (link: string, linkId: string) => {
    await navigator.clipboard.writeText(link)
    setCopiedLinkId(linkId)
    setTimeout(() => setCopiedLinkId(null), 2000)
  }

  const openQrModal = (link: string, title: string) => {
    setQrModalLink(link)
    setQrModalTitle(title)
    setIsQrModalOpen(true)
  }

  const addTag = (tag: string) => {
    if (tags.length >= 3) return
    setTags([...tags, tag])
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  if (generatedLinks.length > 0) {
    return (
      <div className="min-h-screen p-4">
        <Header />
        <div className="container mx-auto max-w-4xl py-16">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                {generatedLinks[0]?.imgUrl ? (
                  <div className="relative">
                    <img 
                      src={generatedLinks[0]?.imgUrl} 
                      alt="Share Image" 
                      className="w-32 h-32 rounded-full object-cover shadow-lg border-4 border-green-100"
                    />
                  </div>
                ) : (
                  <div className="p-3 bg-green-100 rounded-full">
                    <Shield className="w-8 h-8 text-green-600" />
                  </div>
                )}
              </div>
              <CardTitle className="text-2xl">
                {formData.multiRecipient ? `${generatedLinks.length} Secure Links Created!` : 'Secure Link Created!'}
              </CardTitle>
              <CardDescription>
                Your secret has been encrypted client-side and is ready to share with {formData.multiRecipient ? 'multiple recipients' : 'your recipient'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {formData.multiRecipient ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Recipient Links
                  </h3>
                  {generatedLinks.map((link) => (
                    <Card key={link.recipientId} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {link.recipientName}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Expires: {link.expirationTime} • Max views: {link.maxViews}
                          {link.requirePassword && ' • Password protected'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        <div className="flex gap-2">
                          <Input 
                            value={link.shareLink} 
                            readOnly 
                            className="font-mono text-xs" 
                          />
                          <Button 
                            onClick={() => copyToClipboard(link.shareLink, link.recipientId)} 
                            variant="outline"
                            size="sm"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button 
                            onClick={() => openQrModal(link.shareLink, `${formData.title} - ${link.recipientName}`)} 
                            variant="outline"
                            size="sm"
                          >
                            <QrCode className="w-4 h-4" />
                          </Button>
                        </div>
                        {copiedLinkId === link.recipientId && (
                          <p className="text-sm text-green-600 mt-1">Copied to clipboard!</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="share-link">Secure Share Link</Label>
                    <div className="flex gap-2 mt-2">
                      <Input 
                        id="share-link" 
                        value={generatedLinks[0].shareLink} 
                        readOnly 
                        className="font-mono text-sm" 
                      />
                      <Button onClick={() => copyToClipboard(generatedLinks[0].shareLink, generatedLinks[0].recipientId)} variant="outline">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button onClick={() => openQrModal(generatedLinks[0].shareLink, formData.title)} variant="outline">
                        <QrCode className="w-4 h-4" />
                      </Button>
                    </div>
                    {copiedLinkId === generatedLinks[0].recipientId && (
                      <p className="text-sm text-green-600 mt-1">Copied to clipboard!</p>
                    )}
                  </div>
                </div>
              )}

              <Alert>
                <Key className="w-4 h-4" />
                <AlertDescription>
                  <strong>Security Notice:</strong> The decryption key is included in the URL fragment (#) and never
                  sent to our servers. Only share each complete link with its intended recipient.
                </AlertDescription>
              </Alert>

              <Alert>
                <Shield className="w-4 h-4" />
                <AlertDescription>
                  <strong>Important:</strong> Each link will expire based on its individual settings. Your data is encrypted with
                  AES-256 and can only be decrypted by someone with the complete link.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    setGeneratedLinks([])
                    setFormData({
                      title: "",
                      content: "",
                      linkType: "standard",
                      multiRecipient: false,
                    })
                    setSingleRecipientSettings({
                      expirationTime: "1h",
                      maxViews: 1,
                      requirePassword: false,
                      password: "",
                    })
                    setRecipients([])
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Create Another
                </Button>
                {/* <Link href="/" className="flex-1">
                  <Button
                    variant="outline"
                    className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Home
                  </Button>
                </Link> */}
              </div>
            </CardContent>
          </Card>
          <QrCodeModal
            isOpen={isQrModalOpen}
            onClose={() => setIsQrModalOpen(false)}
            url={qrModalLink}
            title={qrModalTitle}
          />
        </div>
      </div>
    )
  }

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 mx-auto mb-4"></div>
          <p>Loading secure encryption...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <Header />
      <div className="container mx-auto max-w-2xl py-8">
        <div className="mb-6">
          {/* <Link href="/">
            <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link> */}
        </div>

        {/* <SecurityTips /> */}
        
        <Card>
          <CardHeader>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            {/* <CardTitle>Upload Logo*</CardTitle> */}
          {!localImagesPreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 w-24 h-24  !mt-10  flex flex items-center justify-center overflow-hidden mx-auto border-dashed border-gray-300 dark:border-gray-600 rounded-full p-6 text-center cursor-pointer hover:border-gray-400 transition"
            >
                <Plus className=" w-10 h-10 text-gray-400" />
            </div>
            ) : (
              <div className="relative w-24 h-24 !mt-10 mx-auto rounded-full cursor-pointer">
                <img
                  src={localImagesPreview}
                  alt="Preview"
                  className="w-full h-full rounded-full object-cover shadow-lg"
                />

                <button
                  type="button"
                  onClick={() => {
                    removeImage();
                    fileInputRef.current?.click();
                  }}
                  className="absolute -right-1 bottom-2 text-green-600 bg-white border border-white rounded-full p-1"
                >
                  <PenLine className="w-4 h-4" />
                </button>
              </div>
            )}
              <span className="text-xs text-center text-gray-500 !mt-2 !mb-10">Upload Logo*</span>
            <CardTitle >Create Secure Vlag</CardTitle>
            <CardDescription>
              Encrypt and share sensitive information with client-side AES-256 encryption
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

                <div>
                <Label htmlFor="title">Title*</Label>
                <Input
                  id="title"
                  placeholder="e.g., Database Password, API Key"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
             
              <div className="space-y-3 p-4 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <Label htmlFor="content" className="text-base font-medium">Secret Content *</Label>
                

                
                <Textarea
                  id="content"
                  placeholder="Enter your password, API key, or sensitive information here..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This content will be encrypted with AES-256 in your browser before transmission.
                </p>

                

                {/* <InlineTip className="mt-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    <strong>Pro tip:</strong> For login credentials, consider sharing the username, password, and server details in separate links for enhanced security isolation.
                  </span>
                </InlineTip> */}
              </div>
              
              <Button
                    type="button"
                     onClick={() => fileRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="w-5 h-5" />

                    Attach files
              </Button>
              {files.length > 0 && (
                <div className="bg-neutral-900 rounded-lg p-3 text-sm text-gray-300 space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center  gap-3"
                    >
                      <p className="truncate flex-1 gap-2 flex items-center">
                        📷 {file.name}

                        <button
                        type="button"
                        onClick={() =>
                          setFiles(prev => prev.filter((_, i) => i !== index))
                        }
                        className="text-gray-400 hover:text-red-500 transition"
                      >
                        ✕
                      </button>
                      </p>
                    </div>
                  ))}
                </div>
              )}

                <input
                ref={fileRef}
                type="file"
                className="hidden"
                 accept="image/*"
                  onChange={handleFileChange}
              />
              {/* Expiration and Views - Always Visible */}
              {!formData.multiRecipient && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expiration">Expiration Time</Label>
                    <Select
                      value={singleRecipientSettings.expirationTime}
                      onValueChange={(value) => setSingleRecipientSettings({ ...singleRecipientSettings, expirationTime: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15m">15 minutes</SelectItem>
                        <SelectItem value="1h">1 hour</SelectItem>
                        <SelectItem value="24h">24 hours</SelectItem>
                        <SelectItem value="3d">3 days</SelectItem>
                        <SelectItem value="7d">7 days</SelectItem>
                        <SelectItem value="10d">10 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="maxViews">Max Views</Label>
                    <Select
                      value={singleRecipientSettings.maxViews.toString()}
                      onValueChange={(value) => setSingleRecipientSettings({ ...singleRecipientSettings, maxViews: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 view</SelectItem>
                        <SelectItem value="3">3 views</SelectItem>
                        <SelectItem value="5">5 views</SelectItem>
                        <SelectItem value="10">10 views</SelectItem>
                        <SelectItem value="100">100 views</SelectItem>
                        <SelectItem value="100000">Unlimited  views</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {!formData.multiRecipient && (
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="requirePassword">Require Password</Label>
                        <p className="text-sm text-gray-600">Add an extra layer of security</p>
                      </div>
                      <Switch
                        id="requirePassword"
                        checked={singleRecipientSettings.requirePassword}
                        onCheckedChange={(checked) => setSingleRecipientSettings({ ...singleRecipientSettings, requirePassword: checked })}
                      />
                    </div>

                    {singleRecipientSettings.requirePassword && (
                      <div>
                        <Label htmlFor="password">Access Password</Label>
                        <div className="flex gap-2 mt-1">
                          <PasswordInput
                            id="password"
                            placeholder="Enter a password to protect this secret"
                            value={singleRecipientSettings.password}
                            onChange={(e) => setSingleRecipientSettings({ ...singleRecipientSettings, password: e.target.value })}
                            required={singleRecipientSettings.requirePassword}
                            className="flex-1"
                          />
                          <Button type="button" variant="outline" onClick={() => generateSecurePassword()}>
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Click the refresh button to generate a secure random password. Use the eye icon to view the password.
                        </p>
                      </div>
                    )}
                  </div>
              )}
              {/* Advanced Settings */}
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white" disabled={isLoading}>
                {isLoading ? "Creating Secure Links..." : formData.multiRecipient ? "Vlag It " : "Vlag It "}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


